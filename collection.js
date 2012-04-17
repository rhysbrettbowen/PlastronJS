//     (c) 2012 Rhys Brett-Bowen, Catch.com
//     goog.mvc may be freely distributed under the MIT license.
//     For all details and documentation:
//     https://github.com/rhysbrettbowen/goog.mvc

goog.provide('mvc.Collection');

goog.require('goog.events.Event');
goog.require('goog.events.EventTarget');
goog.require('mvc.Model');



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

  goog.base(this, opt_options);

  /**
   * @private
   * @type {Array.<{model:mvc.Model}>}
   */
  this.models_ = [];

  /**
   * @private
   * @type {?function(mvc.Model, mvc.Model):number}
   */
  this.comparator_ = defaults['comparator'];

  /**
   * @private
   * @type {Array}
   */
  this.modelChangeFns_ = [];

  /**
   * @private
   * @type {boolean}
   */
  this.modelChange_ = false;

  /**
   * @private
   * @type {mvc.Model}
   */
  this.modelType_ = defaults['modelType'];

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
  this.comparator_ = fn;
  this.sort(opt_silent);
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
  if (this.comparator_) {
    var comp = this.comparator_;

    // need to wrap comparator in function to record a change
    this.models_.sort(function(a, b) {
      var ret = comp(a.model, b.model);
      if (ret < 0)
        changeOrder = true;
      return ret;
    });
    this.modelChange_ = true;
  }
  if (!opt_silent && changeOrder) {
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

  // if array then reverse and then run each model through this function
  if (goog.isArray(model)) {
    var ret = goog.array.some(model.reverse(), function(mod) {
      return this.add(mod, opt_ind, true);
    }, this);
    if (ret && !opt_silent)
      this.change();
    return ret;
  }

  // check for index and if not there use the length
  if (goog.isNumber(opt_ind) && opt_ind < 0) {
    opt_ind = this.models_.length + opt_ind;
  }
  var insert = false;

  // if model is not in the list
  if (!goog.array.find(this.models_, function(mod) {
    return mod.model == model;
  })) {

    // insert model and setup listeners for changes
    insert = true;
    this.modelChange_ = true;
    var changeId = model.bindAll(goog.bind(this.sort, this, false));
    var unloadId = model.bindUnload(function(e) {
      this.remove(model);
    }, this);

    goog.array.insertAt(this.models_, {
      model: model,
      unload: unloadId,
      change: changeId
    }, (opt_ind || this.models_.length));

    // sort list
    this.sort(true);
    if (!opt_silent)
      this.dispatchEvent(goog.events.EventType.CHANGE);
  }
  this.length = this.models_.length;
  return insert;
};


/**
 * add a new model with the given options. The type of model is given by the
 * modelType of the collection
 *
 * @param {Object=} opt_options to pass to the model constructor.
 * @param {boolean=} opt_silent to supress change event.
 * @return {mvc.Model} the newly created model.
 */
mvc.Collection.prototype.newModel = function(opt_options, opt_silent) {
  var model = new this.modelType_(opt_options);
  this.add(model, 0, opt_silent);
  return model;
};


/**
 * remove the given model from the collection
 *
 * @param {mvc.Model|Array.<mvc.Model>} model (s) to remove from collection.
 * @param {boolean=} opt_silent to suppress change event.
 * @return {boolean} whether a model was removed.
 */
mvc.Collection.prototype.remove = function(model, opt_silent) {

  // if it's an array then run each one through the function
  if (goog.isArray(model)) {
    var ret = goog.array.some(model, function(mod) {
      return this.remove(mod, true);
    }, this);
    if (ret && !opt_silent)
      this.change();
    return ret;
  }

  // if the model is in the collection
  var modelObj = goog.array.find(this.models_, function(mod) {
    return mod.model == model;
  });
  if (modelObj) {

    // remove listeners and remove model
    this.modelChange_ = true;
    model.unbind(modelObj.unload);
    model.unbind(modelObj.change);
    goog.array.remove(this.models_, modelObj);
    this.sort(true);
    if (!opt_silent)
      this.dispatchEvent(goog.events.EventType.CHANGE);
  }
  this.length = this.models_.length;
  return modelObj;
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
 * @param {function(mvc.Model):Boolean=} opt_filter function to use.
 * @return {Array.<mvc.Model>} cloned array of the collections models.
 */
mvc.Collection.prototype.getModels = function(opt_filter) {
  var mods = goog.array.map(this.models_, function(mod) {
    return mod.model;
  });
  if (opt_filter)
    return goog.array.filter(mods, /** @type {Function} */(opt_filter));
  return mods;
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
 * remove all models from the collection
 *
 * @param {boolean=} opt_silent whether to supress change event.
 */
mvc.Collection.prototype.clear = function(opt_silent) {
  this.remove(this.getModels(), true);
  this.modelChange_ = true;
  if (!opt_silent) {
    this.dispatchEvent(goog.events.EventType.CHANGE);
  }
};


/**
 * use this to bind functions to a change in any of the collections models
 *
 * @param {Function} fn function to run on model change.
 * @param {Object=} opt_handler to set 'this' of function.
 * @return {number} uid to use with unbind.
 */
mvc.Collection.prototype.modelChange = function(fn, opt_handler) {
  var func = goog.bind(fn, (opt_handler || this));
  this.modelChangeFns_.push(func);
  return goog.getUid(func);
};


/**
 * @inheritDoc
 */
mvc.Collection.prototype.unbind = function(id) {
  return goog.array.removeIf(this.modelChangeFns_, function(fn) {
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
  if (this.modelChange_) {
    goog.array.forEach(this.modelChangeFns_, function(fn) {
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
    this.modelChange_ = false;
  }
};
