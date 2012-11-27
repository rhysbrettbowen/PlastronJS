//     (c) 2012 Rhys Brett-Bowen, Catch.com
//     goog.mvc may be freely distributed under the MIT license.
//     For all details and documentation:
//     https://github.com/rhysbrettbowen/goog.mvc

goog.provide('mvc.Collection');

goog.require('goog.events.Event');
goog.require('goog.events.EventTarget');
goog.require('mvc.Model');
goog.require('mvc.Mod');
goog.require('mvc.Filter');



/**
 * A collection of models. Extends model so it has it's own values
 *
 * @constructor
 * @extends {mvc.Model}
 * @param {Object=} opt_options object to apply to new Collection.
 */
mvc.Collection = function(opt_options) {

  // setup options object
  opt_options = opt_options || {};
  var defaults = {
    'comparator': opt_options['comparator'] || null,
    'modelType': opt_options['modelType'] || mvc.Model,
    'models': opt_options['models'] || []
  };
  goog.object.remove(opt_options, 'comparator');
  goog.object.remove(opt_options, 'modelType');
  goog.object.remove(opt_options, 'models');

  /**
   * @private
   * @type {Array.<{model:mvc.Model}>}
   */
  this.models_ = [];

  this.comparator_ = [defaults['comparator'] && 
      goog.bind(defaults['comparator'], this)];

  /**
   * @private
   * @type {Array}
   */
  this.modelChangeFns_ = [];

  /**
   * @private
   * @type {Array}
   */
  this.anyModelChangeFns_ = [];


  /**
   * @private
   * @type {Array}
   */
  this.addedModels_ = [];


  /**
   * @private
   * @type {Array}
   */
  this.addedModelsFns_ = [];


  /**
   * @private
   * @type {Array}
   */
  this.removedModels_ = [];


  /**
   * @private
   * @type {Array}
   */
  this.removedModelsFns_ = [];


  this.modelChange_ = [false];

  this.anyModelChange_ = [false];

  /**
   * @private
   * @type {function(new:mvc.Model, Object=)}
   */
  this.modelType_ = defaults['modelType'];

  goog.base(this, opt_options);

  // setup models
  goog.array.forEach(defaults['models'], function(model) {
    this.add(model, undefined, true);
  }, this);
};
goog.inherits(mvc.Collection, mvc.Model);


/**
 * plucks an attribute from each model and returns as an array. If you pass
 * an array of keys then the array will contain a map of each key and it's
 * value
 *
 * @param {string|Array} key or keys to get values for.
 * @return {Array.<Object.<string, *>>|Array.<*>} hashmap if multiple keys
 * otherwise array of values.
 */
mvc.Collection.prototype.pluck = function(key) {

  // mao to an array
  return goog.array.map(this.models_, function(mod) {
    var model = mod.model;

    // if only one key then return it's value
    if (goog.isString(key))
      return model.get(key);

    // reduce the model to an object with the key/values
    return goog.array.reduce(key, function(map, attr) {
      var val = model.get(attr);
      if (goog.isDefAndNotNull(val)) {
        goog.object.set(map, attr, val);
      }
      return map;
    }, {});
  });
};


/**
 * function to sort models by. Function should take two models and
 * return -1, 0 or 1. Also takes whether to fire a change event after sorting
 *
 * @param {function(mvc.Model, mvc.Model):number} fn to use to sort models.
 * @param {boolean=} opt_silent to suppress change event.
 */
mvc.Collection.prototype.setComparator = function(fn, opt_silent) {
  this.comparator_[0] = goog.bind(fn, this);
  this.sort(opt_silent);
};



mvc.Collection.prototype.getFiltered = function(fn) {
  /** @constructor */
  var Filter = function() {};

  Filter.prototype = this;
  var filter = new Filter();
  filter.init = function(a,b) {};

  goog.mixin(filter, mvc.Mod);
  goog.mixin(filter, mvc.Filter);

  filter.init(this, fn);

  return filter;
};


/**
 * returns the number of models in the collection
 *
 * @return {number} the number of models in the collection.
 */
mvc.Collection.prototype.getLength = function() {
  return this.models_.length;
};


/**
 * tells the collection to sort it's models. This is used internally
 *
 * @param {boolean=} opt_silent to suppress change event.
 */
mvc.Collection.prototype.sort = function(opt_silent) {
  var changeOrder = false;
  if (this.comparator_[0]) {
    var comp = this.comparator_[0];

    // need to wrap comparator in function to record a change
    this.models_.sort(function(a, b) {
      var ret = comp(a.model, b.model);
      if (ret > 0)
        changeOrder = true;
      return ret;
    });
    this.modelChange_[0] = this.modelChange_[0] || changeOrder;
  }
  if (!opt_silent) {
    this.dispatchEvent(goog.events.EventType.CHANGE);
  }
};


/**
 * accepts a model or array of models and adds them at the end unless an index
 * to insert is given
 *
 * @param {mvc.Model|Array.<mvc.Model>} model to insert.
 * @param {number=} opt_ind index to insert at.
 * @param {boolean=} opt_silent to suppress change.
 * @return {boolean} true if inserted, false if already exists.
 */
mvc.Collection.prototype.add = function(model, opt_ind, opt_silent) {

  // check for index and if not there use the length
  if (goog.isNumber(opt_ind) && opt_ind < 0) {
    opt_ind = this.models_.length + opt_ind;
  }
  var ind = 0;
  var insert = false;
  if(!goog.isArray(model))
    model = [model];
  // run each model through this function
  goog.array.forEach(model, function(mod) {

    // if model is passed as an object
    var isModel = mod instanceof mvc.Model;
    if (!isModel) {
        mod = this.createModel(mod);
    }

    if (!goog.array.find(this.models_, function(model) {
      return model.model == mod;
    })) {

        // insert model and setup listeners for changes
        insert = true;
        this.modelChange_[0] = true;
        this.anyModelChange_[0] = true;
        var changeId = mod.bindAll(goog.bind(function() {
          this.anyModelChange_[0] = true;
          this.sort();
        }, this));
        var unloadId = mod.bindUnload(function(e) {
          this.remove(model);
        }, this);

        goog.array.insertAt(this.models_, {
          model: mod,
          unload: unloadId,
          change: changeId
        }, (goog.isNumber(opt_ind) ? opt_ind + ind : this.models_.length));
        // add to index as models are put in
        ind += 1;
        goog.array.insert(this.addedModels_, mod);

      }
    }, this);
    this.length = this.models_.length;
    this.sort(true);
    if (insert && !opt_silent)
      this.change();
    return insert;
};


/**
 * add a new model with the given options to the end of the collection.
 * The type of model is given by the modelType of the collection
 *
 * @param {Object=} opt_options to pass to the model constructor.
 * @param {boolean=} opt_silent to supress change event.
 * @param {function(new:mvc.Model, Object=)=} opt_modelType constructor for
 * the new model.
 * @return {mvc.Model} the newly created model.
 */
mvc.Collection.prototype.newModel = function(
    opt_options, opt_silent, opt_modelType) {
  var model = this.createModel(opt_options, opt_modelType);
  this.add(model, undefined, opt_silent);
  return model;
};

/**
 * create model from object
 * @param {Object=} opt_options to pass to the model constructor.
 * @param {function(new:mvc.Model, Object=)=} opt_modelType constructor for
 * the new model. 
 * @return {mvc.Model} the newly created model
 */
mvc.Collection.prototype.createModel = function(opt_options, opt_modelType) {
  return new (opt_modelType || this.modelType_)(opt_options);
}


/**
 * remove the given model from the collection
 *
 * @param {mvc.Model|Array.<mvc.Model>} model (s) to remove from collection.
 * @param {boolean=} opt_silent to suppress change event.
 * @return {boolean} whether a model was removed.
 */
mvc.Collection.prototype.remove = function(model, opt_silent) {

  // if it's an array then run each one through the function
  if (!goog.isArray(model))
    model = [model];
  var ret = false;
  goog.array.forEach(model, function(model) {
    var modelObj = goog.array.find(this.models_, function(mod) {
      return mod.model == model;
    });
    if (modelObj) {

      // remove listeners and remove model
      this.modelChange_[0] = true;
      this.anyModelChange_[0] = true;
      model.unbind(modelObj.unload);
      model.unbind(modelObj.change);
      goog.array.remove(this.models_, modelObj);
      ret = true;
      goog.array.insert(this.removedModels_, {
        model: model,
        id: model.get('id') || model.getCid()
      });
    }
  }, this);
  this.length = this.models_.length;
  if (ret)
    this.sort(true);
  if (ret && !opt_silent)
    this.change();
  return ret;
};


/**
 * get a model by it's ID
 *
 * @param {string} id of model.
 * @return {?mvc.Model} model that has id or null.
 */
mvc.Collection.prototype.getById = function(id) {
  var model = goog.array.find(this.models_,
      function(model) {
        return model.model.get('id') == id;
      });
  return model ? /** @type {mvc.Model} */(model.model) : null;
};


/**
 * get all the models, optionally filter by function
 *
 * @param {string|function(mvc.Model):Boolean=} opt_filter function to use.
 * @return {Array.<mvc.Model>} cloned array of the collections models.
 */
mvc.Collection.prototype.getModels = function(opt_filter) {
  if(goog.isString(opt_filter)) {
    var str = opt_filter;
    opt_filter = function(model) {
      return model.get(str);
    };
  }
  var mods = goog.array.map(this.models_, function(mod) {
    return mod.model;
  });
  if (opt_filter)
    return goog.array.filter(mods, /** @type {Function} */(opt_filter));
  return mods;
};


mvc.Collection.prototype.setModels = function(arr, opt_silent) {
  var mods = this.getModels();
  goog.array.forEach(mods, function(mod) {
    if (!goog.array.contains(arr, mod))
      this.remove(mod, true);
  }, this);
  goog.array.forEach(arr, function(addMod) {
    this.add(addMod, undefined, true);
  }, this);
  if (!opt_silent)
    this.change();
};


/**
 * get a model by it's index in the collection
 *
 * @param {number} index to return, can use negative to get from back.
 * @return {mvc.Model} the model in the collection.
 */
mvc.Collection.prototype.at = function(index) {
  try {
    return this.models_[index < 0 ? this.models_.length + index : index].model;
  } catch (err) {
    return null;
  }
};


/**
 * return the index of a given model
 *
 * @param {mvc.Model} model to find.
 * @return {number} index of model.
 */
mvc.Collection.prototype.indexOf = function(model) {
  return goog.array.indexOf(this.getModels(), model);
};


/**
 * remove all models from the collection
 *
 * @param {boolean=} opt_silent whether to supress change event.
 * @param {Function=} opt_filter function to detect models to remove.
 */
mvc.Collection.prototype.clear = function(opt_silent, opt_filter) {
  var modelsToClear = this.getModels();
  if (opt_filter) {
    modelsToClear = goog.array.filter(modelsToClear, /** @type {Function} */(opt_filter));
  }
  this.remove(modelsToClear, true);
  this.modelChange_[0] = true;
  if (!opt_silent) {
    this.dispatchEvent(goog.events.EventType.CHANGE);
  }
};

/**
 * removes models that are not satisfying filter condition
 * @param {Function=} filter function to detect models to keep.
 * @param {boolean=} opt_silent whether to suppress change event.
 */
mvc.Collection.prototype.keep = function(filter, opt_silent) {
  return this.clear(opt_silent, function(model, index, array) { 
    return !filter(model, index, array);
  });
};


/**
 * use this to bind functions to a change that effects the order or collection
 *
 * @param {Function} fn function to run on model change.
 * @param {Object=} opt_handler to set 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} bound object.
 */
mvc.Collection.prototype.modelChange = function(fn, opt_handler) {
  var func = goog.bind(fn, (opt_handler || this));
  this.modelChangeFns_.push(func);
  var id = goog.getUid(func);
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
 * use this to bind functions to a change in any of the collections models
 *
 * @param {Function} fn function to run on model change.
 * @param {Object=} opt_handler to set 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} bound object.
 */
mvc.Collection.prototype.anyModelChange = function(fn, opt_handler) {
  var func = goog.bind(fn, (opt_handler || this));
  this.anyModelChangeFns_.push(func);
  var id = goog.getUid(func);
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
 * use this to bind function when a model is added
 
 * @param {Function} fn function to run on model change.
 * @param {Object=} opt_handler to set 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} bound object.
 */
mvc.Collection.prototype.bindAdd = function(fn, opt_handler) {
  var func = goog.bind(fn, (opt_handler || this));
  this.addedModelsFns_.push(func);
  var id = goog.getUid(func);
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
 * use this to bind functions when a model is removed
 *
 * @param {Function} fn function to run on model change.
 * @param {Object=} opt_handler to set 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} bound object.
 */
mvc.Collection.prototype.bindRemove = function(fn, opt_handler) {
  var func = goog.bind(fn, (opt_handler || this));
  this.removedModelsFns_.push(func);
  var id = goog.getUid(func);
  fn = goog.bind(fn, opt_handler || this, this)
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
 * @inheritDoc
 */
mvc.Collection.prototype.unbind = function(id) {
  if(goog.isObject(id) && id.id)
    id = id.id;
  return goog.array.removeIf(this.modelChangeFns_, function(fn) {
    return goog.getUid(fn) == id;
  }) || goog.array.removeIf(this.anyModelChangeFns_, function(fn) {
    return goog.getUid(fn) == id;
  }) || goog.array.removeIf(this.removedModelsFns_, function(fn) {
    return goog.getUid(fn) == id;
  }) || goog.array.removeIf(this.addedModelsFns_, function(fn) {
    return goog.getUid(fn) == id;
  }) || goog.base(this, 'unbind', id);
};


/**
 * @private
 */
mvc.Collection.prototype.change_ = function() {

  // call change_ for mvc.Model
  goog.base(this, 'change_');

  // if the models have changed then fire listeners
  if (this.modelChange_[0]) {
    goog.array.forEach(goog.array.clone(this.modelChangeFns_), function(fn) {
      fn(this);
    }, this);
    this.modelChange_[0] = false;
  }

  // if the models have changed any values then fire listeners
  if (this.anyModelChange_[0]) {
    goog.array.forEach(goog.array.clone(this.anyModelChangeFns_), function(fn) {
      fn(this);
    }, this);

    // if 'models' defined in schema then fire the bound listener.
    if (this.schema_) {
      goog.object.forEach(this.schema_, function(val, key) {
        if (val.models) {
          goog.array.forEach(this.bound_, function(bind) {
            if (goog.array.contains(bind.attr, key)) {
              bind.fn.apply(bind.hn, goog.array.concat(goog.array.map(bind.attr,
                  function(attr) {
                    return this.get(attr);
                  }, this)));
            }
          }, this);
        }
      }, this);
    }
    this.anyModelChange_[0] = false;
  }

  goog.array.forEach(this.removedModelsFns_, function(fn) {
    goog.array.forEach(this.removedModels_, function(mod) {
      fn(mod.model, mod.id);
    });
  }, this);
  goog.array.clear(this.removedModels_);

  goog.array.forEach(this.addedModelsFns_, function(fn) {
    goog.array.forEach(this.addedModels_, function(mod) {
      fn(mod);
    });
  }, this);
  goog.array.clear(this.addedModels_);
};
