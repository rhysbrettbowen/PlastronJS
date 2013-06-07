/*******************************************************************************
********************************************************************************
**                                                                            **
**  Copyright (c) 2012 Catch.com, Inc.                                        **
**                                                                            **
**  Licensed under the Apache License, Version 2.0 (the "License");           **
**  you may not use this file except in compliance with the License.          **
**  You may obtain a copy of the License at                                   **
**                                                                            **
**      http://www.apache.org/licenses/LICENSE-2.0                            **
**                                                                            **
**  Unless required by applicable law or agreed to in writing, software       **
**  distributed under the License is distributed on an "AS IS" BASIS,         **
**  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  **
**  See the License for the specific language governing permissions and       **
**  limitations under the License.                                            **
**                                                                            **
********************************************************************************
*******************************************************************************/

goog.provide('mvc.Model');
goog.provide('mvc.Model.ValidateError');

goog.require('goog.array');
goog.require('goog.events');
goog.require('goog.events.EventTarget');
goog.require('goog.json');
goog.require('goog.object');
goog.require('mvc.Sync');



/**
 * Pass an object with key value pairs for the attributes of the model
 *
 * @constructor
 * @extends {goog.events.EventTarget}
 * @param {Object=} opt_options can take in the arguments attr,
 * schema and sync.
 */
mvc.Model = function(opt_options) {
  goog.base(this);
  // setup the defaults
  var defaults = {
    'schema': {},
    'sync': null,
    'attr': {}
  };

  if (!opt_options)
    opt_options = {};
  opt_options['attr'] = opt_options['attr'] || {};

  goog.object.forEach(opt_options, function(val, key) {
    if (!goog.isDef(defaults[key]))
      opt_options['attr'][key] = val;
  });

  goog.object.forEach(defaults, function(val, key) {
    defaults[key] = opt_options[key] || defaults[key];
  });


  /**
 * @private
 * @type {Object.<string, ?Object>}
 */
  this.attr_ = {};

  /**
 * @private
 * @type {Object.<{attr: Array.<string>, fn: Function}>}
 */
  this.formats_ = {};

  /**
 * @private
 * @type {Object.<string, ?Object>}
 */
  this.prev_ = {};

  /**
     * @private
     * @type {Object}
     */
  this.schema_ = defaults['schema'] || {};

  this.sync_ = defaults['sync'];

  this.bound_ = [];
  this.boundAll_ = {};
  this.onUnload_ = [];

  this.autosaver = null;

  this.handleErr_ = goog.nullFunction;

  this.changeHandler_ = goog.events.listen(this,
      goog.events.EventType.CHANGE, this.change_, false, this);
  /**
 * @private
 * @type {string}
 */
  this.cid_ = '' + goog.getUid(this);

  this.changing_ = [false];
  this.waitChange_ = {};
  this.waitChangeSilent_ = [true];

  this.set(defaults['attr']);


  this.dispatchEvent(goog.events.EventType.LOAD);
};
goog.inherits(mvc.Model, goog.events.EventTarget);


/**
 * functions for use with the cmp parameter in the schema
 *
 * @enum {function(*, *):boolean}
 */
mvc.Model.Compare = {
  /**
 * @param {*} a first object to compare.
 * @param {*} b second object to compare.
 * @return {boolean} whether they are equal.
 */
  RECURSIVE: function(a, b) {

    // if a and b are objects then recurse through keys and check values
    if (goog.isObject(a)) {
      if (goog.isObject(b)) {
        var aKeys = goog.object.getKeys(a);
        var bKeys = goog.object.getKeys(b);
        if (!goog.array.equals(aKeys, bKeys)) {
          return false;
        }
        for (var i = 0; i < aKeys.length; i++) {
          if (!mvc.Model.Compare.RECURSIVE(a[aKeys[i]], b[bKeys[i]])) {
            return false;
          }
        }
        return true;
      } else {
        return false;
      }
    } else if (goog.isObject(b)) {
      return false;
    }
    return a === b;
  },
  /**
 * @param {*} a first object to compare.
 * @param {*} b second object to compare.
 * @return {boolean} whether they are equal.
 */
  STRING: function(a, b) {
    try {
      return a.toString() === b.toString();
    } catch (err) {
      return false;
    }
  },
  /**
 * @param {*} a first object to compare.
 * @param {*} b second object to compare.
 * @return {boolean} whether they are equal.
 */
  SERIALIZE: function(a, b) {
    return goog.json.serialize(a) === goog.json.serialize(b);
  }
};


/**
 * return local id
 *
 * @return {string} the model's local ID.
 */
mvc.Model.prototype.getCid = function() {
  return this.cid_;
};


/**
 * used internally to parse strings and regexes in to functions
 *
 * @private
 * @param {*} fn schema rule to turn in to a function.
 * @return {Function} converted function.
 */
mvc.Model.prototype.parseSchemaFn_ = function(fn) {
  var val = fn;

  // converts string to function
  if (goog.isString(fn)) {
    var fns = {
      'number': goog.isNumber,
      'string': goog.isString,
      'array': goog.isArrayLike
    };
    return function(value) {
      if (!fns[fn.toLowerCase()](value))
        throw new mvc.Model.ValidateError('value not a ' + fn);
      return value;
    };
  } else if (val.exec) {

    // convert regex to function
    return goog.bind(function(regex, value, mod) {
      if (goog.isNull(regex.exec(value))) {
        throw new mvc.Model.ValidateError(regex + 'note matched');
      }
      return value;}, this, fn);
  } else if (goog.isFunction(val) &&
      goog.object.getKeys(val.prototype).length) {

    // convert constructor function to check type
    val = function(val) {
      if(!goog.isObject(val))
        throw new mvc.Model.ValidateError('not of type:\n' + fn);
      var currClass = Object.getPrototypeOf(val).constructor;
      if (Object.getPrototypeOf(val).constructor == fn) {
        return val;
      }
      while (currClass.superClass_) {
        currClass = currClass.superClass_.constructor;
        if (currClass == fn) {
          return val;
        }
      }
      throw new mvc.Model.ValidateError('not of type:\n' + fn);
    };
  }
  return /** @type {Function} */(val);
};


/**
 * instead of doing: model = new mvc.Model(options);
 * you can do: mvc.Model.create(options);
 *
 * @param {Object=} opt_options object to pass to mvc.Model constructor.
 * @return {mvc.Model} new model.
 */
mvc.Model.create = function(opt_options) {
  return new mvc.Model(opt_options);
};


/**
 * returns full copy of the attributes
 *
 * @return {!Object} the model as a json - this should probably be overridden.
 */
mvc.Model.prototype.toJson = function() {
  var json = goog.object.clone(this.attr_);

  var recurseRemove = function(obj) {
    if (!goog.isObject(obj))
      return;
    goog.array.forEach(goog.object.getKeys(obj), function(key) {
      if (!goog.isDef(obj[key]))
        delete obj[key];
      else if (goog.isObject(obj[key]))
        recurseRemove(obj[key]);
    });
  };

  recurseRemove(json);

  return json;
};


/**
 * sets the sync for the model
 *
 * @param {mvc.Sync} sync to set the sync for the object.
 */
mvc.Model.prototype.setSync = function(sync) {
  this.sync_ = sync;
};


/**
 * removes all attributes
 *
 * @param {boolean=} opt_silent whether to fire change event.
 */
mvc.Model.prototype.reset = function(opt_silent) {
  this.prev_ = /** @type {Object} */(goog.object.unsafeClone(this.attr_));
  goog.array.forEach(goog.object.getKeys(this.prev_), function(key) {
    this.set(key, undefined, true);
  }, this);
  if (!opt_silent)
    this.change();
};


/**
 * gets the value for an attribute
 *
 * @param {Array|string} key to get value of.
 * @param {*=} opt_default will return if value is undefined.
 * @return {*} the value of the key.
 */
mvc.Model.prototype.get = function(key, opt_default) {
  if(goog.isArray(key)) {
    return goog.array.reduce(key, function(obj, k) {
      obj[k] = this.get(k, opt_default);
      return obj;
    }, {}, this);
  }

  // if a getter is defined in a schema then use that
  if (this.schema_[key] && this.schema_[key].get) {
    var get = this.schema_[key].get.apply(this, goog.array.map(
        this.schema_[key].require || [], function(requireKey) {
          if (requireKey === key) {
            return this.attr_[key];
          }
          var get = this.get(requireKey);
          return goog.isDef(get) ? get : opt_default;
        },this));
    return goog.isDef(get) ? get : opt_default;
  }
  if (key.indexOf('.') < 0)
    return goog.isDef(this.attr_[key]) ? this.attr_[key] : opt_default;
  var path = key.split('.').reverse();
  var obj = this.get(path.pop());
  while (path.length && goog.isDef(obj))
    obj = obj[path.pop()];
  return goog.isDef(obj) ? obj : opt_default;
};


/**
 * returns whether an ID has been set by the server
 *
 * @return {boolean} if the id hasn't been set then true.
 */
mvc.Model.prototype.isNew = function() {
  return !goog.isDef(this.get('id'));
};


/**
 * sets the schema
 *
 * @param {Object} schema to set this model's schema to.
 */
mvc.Model.prototype.setSchema = function(schema) {
  this.schema_ = schema;
};


/**
 * adds more rules to the schema
 *
 * @param {Object} schema to add rules from.
 */
mvc.Model.prototype.addSchemaRules = function(schema) {
  this.schema_ = goog.object.clone(this.schema_);
  goog.object.forEach(schema, function(val, key) {
    if (this.schema_[key])
      goog.object.extend(this.schema_[key], goog.object.clone(schema[key]));
    else
      this.schema_[key] = goog.object.clone(schema[key]);
  }, this);
};


/**
 * @param {string} key to test existence of.
 * @return {boolean} whether key exists.
 */
mvc.Model.prototype.has = function(key) {
  return (goog.object.containsKey(this.attr_, key) ||
      goog.object.containsKey(this.schema_, key)) &&
      goog.isDef(this.get(key));
};


/**
 * set either a map of key values or a key value
 *
 * @param {Object|string} key object of key value pairs to set, or the key.
 * @param {*=} opt_val to use if the key is a string, or if key is an object
 * then a boolean for silent.
 * @param {boolean=} opt_silent true if no change event should be fired.
 * @return {boolean} return if succesful.
 */
mvc.Model.prototype.set = function(key, opt_val, opt_silent) {

  if (this.changing_[0]) {
    if (goog.isString(key)) {
      this.waitChange_[key] = opt_val;
      this.waitChangeSilent_[0] = this.waitChangeSilent_[0] && opt_silent;
    } else {
      goog.object.extend(this.waitChange_, key);
      this.waitChangeSilent_[0] = this.waitChangeSilent_[0] && opt_val;
    }
    return false;
  }

  // handle key value as string or object
  var success = false;
  if (goog.isString(key)) {
    var temp = {};
    temp[key] = opt_val;
    key = temp;
  } else {
    opt_silent = /** @type {boolean} */(opt_val);
  }

  // for each key:value try to set using schema else set directly
  goog.object.forEach(key, function(val, key) {
    try {
      // use setter
      if (this.schema_[key] && this.schema_[key].set) {
        val = this.parseSchemaFn_(this.schema_[key].set)
          .call(this, val, opt_silent);
      }
      // handle dot delimitted paths
      var path = key.split('.').reverse();
      var obj = this.attr_;
      while (path.length > 1) {
        var curr = path.pop();
        obj[curr] = obj[curr] || {};
        obj = obj[curr];
      }
      // set value
      obj[path.pop()] = val;
      // test for change
      var schema = this.schema_[key];
      var get = this.get(key);
      var prev = this.prev(key);
      if (goog.isDef(schema) && goog.isFunction(schema.cmp)) {
        var cmp = schema.cmp;
        if (goog.isFunction(cmp) &&
            !cmp(get, prev)) {
          success = true;
        }
      } else if (goog.isObject(get) || goog.isObject(prev)) {
        if (!mvc.Model.Compare.RECURSIVE(get, prev))
          success = true;
      } else if (get !== prev) {
        success = true;
      }
    // catch validation errors
    } catch (err) {
      if (err.isValidateError)
        this.handleErr_(err);
      else
        throw err;
    }
  }, this);

  // if it was successful and not silent then fire change and then set
  // previous values
  if (success) {
    if (!opt_silent) {
      this.dispatchEvent(goog.events.EventType.CHANGE);
      this.prev_ = /** @type {Object.<(Object|null)>|null} */
          (goog.object.unsafeClone(this.attr_));
      this.attr_ = goog.object.filter(this.attr_, function(val, key) {
        return goog.isDef(val);
      });
    }
    return true;
  }
  return false;
};


/**
 * @param {Array|string|boolean=} opt_key to remove (calls to it's get return undefined).
 * @param {boolean=} opt_silent true if no change event should be fired.
 * @return {boolean} return if succesful.
 */
mvc.Model.prototype.unset = function(opt_key, opt_silent) {
  if (goog.isString(opt_key))
    return this.set(opt_key, undefined, opt_silent);
  if (!goog.isArray(opt_key)) {
    opt_key = goog.object.getKeys(this.attr_);
  }
  var temp = {};
  goog.array.forEach(opt_key, function(k) {
    temp[k] = undefined;
  });
  return this.set(temp, opt_key);

};


/**
 * fires the change event for the model
 */
mvc.Model.prototype.change = function() {
  this.dispatchEvent(goog.events.EventType.CHANGE);
};


/**
 * returns the previous value of the attribute
 *
 * @param {string} key to lookup previous value of.
 * @return {*} the previous value.
 */
mvc.Model.prototype.prev = function(key) {

  // use schema if one is defined
  if (this.schema_[key] && this.schema_[key].get) {
    var get = this.schema_[key].get.apply(this, goog.array.map(
        this.schema_[key].require || [], function(requireKey) {
          if (requireKey === key) {
            return this.prev_[key];
          }
          var get = this.prev(requireKey);
          return get;
        },this));
    return get;
  }
  return this.prev_[key];
};


/**
 * Can be used to create an alias, e.g:
 * model.alias('surname', 'lastName');
 *
 * @param {string} newName of the get attribute.
 * @param {string} oldName of the get attribute.
 */
mvc.Model.prototype.alias = function(newName, oldName)  {
  if (!this.schema_[newName])
    this.schema_[newName] = {};
  this.schema_[newName].get = function(oldName) {
    return oldName;
  };
  this.schema_[newName].set = function(val, silent) {
    this.set(oldName, val, silent);
  };
  this.schema_[newName].require = [oldName];
};


/**
 * Can be used to change format returned when using get, e.g:
 * model.format('date', function(date) {return date.toDateString();});
 *
 * @param {string} attr to set the formatter for.
 * @param {Function} fn function that takes the attributes value and returns
 * the value in the format required. 'this' is set to the model.
 */
mvc.Model.prototype.format = function(attr, fn)  {
  if (!this.schema_[attr])
    this.schema_[attr] = {};
  this.schema_[attr].get = goog.bind(fn, this);
  this.schema_[attr].require = [attr];
};


/**
 * Can be used to make an attribute out of other attributes. This can be bound
 * and will fire whenever a change is made to the required attributes e.g.
 * model.meta('fullName', ['firstName', 'lastName'],
 *     function(firstName, lastName){
 *         return firstName + " " + lastName;
 *     });
 *
 * @param {string} attr that will be called by get.
 * @param {Array.<string>} require attributes needed to compute the output.
 * @param {Function} fn the function should take the value of any required
 * attributes in order. 'this' will be bound to the model.
 */
mvc.Model.prototype.meta = function(attr, require, fn) {
  if (!this.schema_[attr])
    this.schema_[attr] = {};
  this.schema_[attr].get = goog.bind(fn, this);
  this.schema_[attr].require = require;
};


/**
 * @param {string} attr the attribute to set the stter for.
 * @param {Function} fn the function to be used as a setter. The function
 * should take the new value as an argument and return the transformed value.
 * The function can also throw errors if the value doesn't validate. The
 * function will have 'this' cound to the model.
 */
mvc.Model.prototype.setter = function(attr, fn) {
  this.schema_[attr] = this.schema_[attr] || {};
  this.schema_[attr].set = goog.bind(fn, this);
};


/**
 * returns object of changed attributes and their values
 *
 * @return {Array.<string>} array of the key names that have changed. Used
 * internally to decide which attributes to fire change functions for.
 */
mvc.Model.prototype.getChanges = function() {

  var schema = this.schema_;

  var keys = goog.array.concat(goog.object.getKeys(schema),
      goog.object.getKeys(this.attr_));
  goog.array.removeDuplicates(keys);

  return goog.array.reduce(keys, function(arr, key) {
    var prev = this.prev(key);
    var get = this.get(key);
    var sk = schema[key];
    if (sk && goog.isDef(sk.cmp)) {
      if (goog.isDef(sk.cmp) && !sk.cmp(prev, get)) {
        arr.push(key);
      }
      return arr;
    }
    return goog.array.concat(arr, this.getObjChanges_(get, prev, key));
  }, [], this);
};

/**
 * returns an array of paths that are different
 *
 * @param {*} a first object
 * @param {*} b second object
 * @param {string} path the rooth path
 * @return {Array.<string>} [description]
 */
mvc.Model.prototype.getObjChanges_ = function(a, b, path) {
  if (!goog.isObject(a) && !goog.isObject(b)) {
    return a === b ? [] : [path];
  }
  var keys = goog.array.concat(goog.object.getKeys(/** @type {Object} */(a)),
      goog.object.getKeys(/** @type {Object} */(b)));
  goog.array.removeDuplicates(keys);
  var ret = goog.array.reduce(keys, function(arr, key) {
    if (!goog.isObject(a))
      return goog.array.concat(arr,
          this.getObjChanges_(undefined, b[key], path + '.' + key));
    if (!goog.isObject(b))
      return goog.array.concat(arr,
          this.getObjChanges_(a[key], undefined, path + '.' + key));
    return goog.array.concat(arr,
        this.getObjChanges_(a[key], b[key], path + '.' + key));
  }, [], this);
  if (ret.length) ret.push(path);
  return ret;
};


/**
 * reverts an object's values to it's last fetch
 * TODO: allow to revert only certain keys
 *
 * @param {boolean=} opt_silent whether to fire change event.
 * @return {mvc.Model} with it's attributes reverted to previous change.
 */
mvc.Model.prototype.revert = function(opt_silent) {
  this.attr_ = /** @type {Object.<string, ?Object>} */
      (goog.object.unsafeClone(this.prev_));
  if (!opt_silent) {
    this.dispatchEvent(goog.events.EventType.CHANGE);
  }
  return this;
};


/**
 * @param {boolean=} opt_sync pass true to del the sync to delete the model.
 * @param {Function=} opt_callback function to call after sync delete finishes
 * @override
 */
mvc.Model.prototype.dispose = function(opt_sync, opt_callback) {
  if (opt_sync)
    this.sync_.del(this, opt_callback);
  this.dispatchEvent(goog.events.EventType.UNLOAD);
  goog.array.forEach(goog.array.clone(this.onUnload_), function(fn) {
    fn(this);
  }, this);
  goog.base(this, 'dispose');
};


/**
 * @param {Function} fn handler function to handle errors.
 */
mvc.Model.prototype.errorHandler = function(fn) {
  this.handleErr_ = fn;
};


/**
 * reads an object fomr an external source using sync
 *
 * @param {function(Object, number, mvc.Model)=} opt_callback will be called
 * when fetch is complete.
 */
mvc.Model.prototype.fetch = function(opt_callback) {
  this.sync_.read(this, opt_callback);
};


/**
 * pushes the object to the sync
 *
 * @param {Function=} opt_callback optional callback for sync.
 */
mvc.Model.prototype.save = function(opt_callback) {
  if (this.sync_)
    if (this.isNew())
      this.sync_.create(this, opt_callback);
    else
      this.sync_.update(this, opt_callback);
};


/**
 * sets up auto save on changes
 *
 * @param {string|Array|Function=} opt_vals values to save on. If none provided
 * will save on any change, if a string hten save only on that key, if an array
 * then save on any of those changes, if a function it's the callback for any
 * change save.
 * @param {Function=} opt_callback for save complete.
 * @return {{fire: Function, id: number, unbind: Function}|boolean} save binder
 */
mvc.Model.prototype.autosave = function(opt_vals, opt_callback) {
  if(this.autosaver)
    return false;
  if(goog.isFunction(opt_vals)) {
    opt_callback = opt_vals;
    opt_vals = undefined;
  }
  if(!opt_vals)
    this.autosaver = this.bindAll(goog.bind(this.save, this, opt_callback));
  else
    this.autosaver =
      this.bind(opt_vals, goog.bind(this.save, this, opt_callback));
  return this.autosaver;
};


/**
 * can use this to construct setters. For instance if you would set a value
 * like:
 *   model.set('location:latitude', number);
 * you can make a convenience method like this:
 * model.lat = model.getBinder('location:latitude');
 * and then you only need to use:
 *   model.lat(number); // to set
 *   var lat = model.lat(); // to get
 *
 * @param {string} key to create binder for.
 * @return {Function} a function that will take a value to set
 * or nothing to get the key's value.
 */
mvc.Model.prototype.getBinder = function(key) {
  return goog.bind(function(val, opt_silent) {
    if (goog.isDef(val)) {
      this.set(key, val, opt_silent);
    } else {
      return this.get(key);
    }
  }, this);
};


/**
 * function called when a change is detected on the object. Call the model's
 * .change() function to fire manually
 *
 * @private
 */
mvc.Model.prototype.change_ = function() {
  this.changing_[0] = true;
  var changes = this.getChanges();
  goog.array.forEach(this.bound_, function(val) {
    if (goog.array.some(val.attr, function(attr) {
      return goog.array.contains(changes, attr);
    })) {
      val.fn.apply(val.hn, goog.array.concat(goog.array.map(val.attr,
          function(attr) {
            return this.get(attr);
          },this)));
    }
  }, this);
  if (changes.length) {
    goog.object.forEach(this.boundAll_, function(val) {
      val(this);
    }, this);
  }
  this.prev_ = /** @type {Object.<(Object|null)>|null} */
      (goog.object.unsafeClone(this.attr_));
  this.changing_[0] = false;
  var clone = goog.object.clone(this.waitChange_);
  goog.object.clear(this.waitChange_);
  var silent = this.waitChangeSilent_[0];
  this.waitChangeSilent_[0] = true;
  this.set(clone, silent);
};


/**
 * @param {Function} fn function to run when model is disposed.
 * @param {Object=} opt_handler object for 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} to unbind.
 */
mvc.Model.prototype.bindUnload = function(fn, opt_handler) {
  fn = goog.bind(fn, (opt_handler || this));
  var uid = goog.getUid(fn);
  this.onUnload_.push(fn);
  var ret = {
    fire: function() {
      fn();
      return ret;
    },
    id: uid,
    unbind: goog.bind(this.unbind, this, uid)
  };
  return ret;
};


/**
 * Allows easy binding of a model's attribute to an element or a function.
 * bind('name', function(value), handler) allows you to run a function and
 * optionally bind it to the handler. You can also pass in an array of names
 * to listen for a change on any of the attributes.
 *
 * @param {Array|string} name of attributes to listen to.
 * @param {Function} fn function to run when change.
 * @param {Object=} opt_handler object for 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} to unbind.
 */
mvc.Model.prototype.bind = function(name, fn, opt_handler) {
  if (goog.isString(name))
    name = [name];
  var bind = {
    attr: name,
    fn: fn,
    hn: (opt_handler || this)
  };
  bind.cid = goog.getUid(bind);
  this.bound_.push(bind);
  var ret = {
    fire: goog.bind(function() {
      var get = goog.array.map(/** @type {Array} */(name), function(n) {
        return this.get(n);
      }, this);
      get.push(this);
      fn.apply(opt_handler || this, get);
      return ret;
    }, this),
    id: bind.cid,
    unbind: goog.bind(this.unbind, this, bind.cid)
  };
  return ret;
};


/**
 * unbind a listener by id
 *
 * @param {Object|number} id returned form bind or bindall.
 * @return {boolean} if found and removed.
 */
mvc.Model.prototype.unbind = function(id) {
  if(goog.isObject(id) && id.id)
    id = id.id;
  return goog.array.removeIf(this.bound_, function(bound) {
    return (bound.cid == id);
  }) || goog.object.remove(this.boundAll_, id) ||
      goog.array.removeIf(this.onUnload_, function(fn) {
        return goog.getUid(fn) == id;
      });
};


/**
 * bind to any change event
 *
 * @param {Function} fn function to bind.
 * @param {Object=} opt_handler object to bind 'this' to.
 * @return {{fire: Function, id: number, unbind: Function}} to unbind.
 */
mvc.Model.prototype.bindAll = function(fn, opt_handler) {
  var bound = goog.bind(fn, (opt_handler || this));
  var id = goog.getUid(bound);
  goog.object.set(this.boundAll_, '' + id, bound);
  fn = goog.bind(fn, opt_handler || this, this);
  var ret = {
    fire: function() {
      fn();
      return ret;
    },
    id: id,
    unbind: goog.bind(this.unbind, this, id)
  };
  return ret;
};


/**
 * Validate Error class.
 *
 * @constructor
 * @param {string=} opt_message for error.
 * @param {string=} opt_filename for error.
 * @param {number=} opt_lineno for error.
 * @extends {Error}
 */
mvc.Model.ValidateError = function(opt_message, opt_filename, opt_lineno) {
  goog.base(this, opt_message || 'validation error', opt_filename, opt_lineno);
  this.isValidateError = true;
};
goog.inherits(mvc.Model.ValidateError, Error);