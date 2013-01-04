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

goog.provide('mvc.Control');

goog.require('goog.dom');
goog.require('goog.object');
goog.require('mvc.Layout');



/**
 * instantiate with a mvc.Model
 *
 * @constructor
 * @param {mvc.Model} model to link with the control.
 * @extends {mvc.Layout}
 */
mvc.Control = function(model) {
  mvc.Control.superClass_.constructor.apply(
      this, goog.array.slice(arguments, 1));
  this.modelListeners_ = [];
  this.autoBinders_ = [];
  this.setModel(model);
  this.contentElement_ = null;
};
goog.inherits(mvc.Control, mvc.Layout);


/**
 * use this to change what mvc.Control inherits from.
 * 
 * @param {Function} base e.g. goog.ui.Control.
 * @param {Function=} opt_call if you need to instantiate a class other than
 * mvc.Control that inherits from mvc.Control.
 * @param {...*} var_args the parameters to pass to the constructor - the first
 * will probably be an mvc.Model.
 */
mvc.Control.create = function(base, opt_call, var_args) {
  var args = goog.array.slice(arguments, 2);
  var control = null;

  var proto = {};
  goog.object.forEach(mvc.Control.prototype, function(val, key, obj) {
    if (obj.hasOwnProperty(key))
      proto[key] = val;
  });
  goog.inherits(mvc.Layout, base);
  goog.object.extend(mvc.Control.prototype, proto);

  opt_call = opt_call || mvc.Control;

  /** @constructor */
  var temp = function() {};
  temp.prototype = opt_call.prototype;
  control = new temp();
  opt_call.apply(control, args);

  goog.inherits(mvc.Layout, goog.ui.Component);
  goog.object.extend(mvc.Control.prototype, proto);
  return control;

};


/**
 * Functions that can be passed to the mvc.Model.bind
 *
 * @enum {Function}
 */
mvc.Control.Fn = {
  TEXT: goog.dom.setTextContent,
  VAL: function(el, val) {el.value = val;},
  CLASS: goog.dom.classes.add
};


/**
 * @inheritDoc
 */
mvc.Control.prototype.setElementInternal = function(el) {
  goog.base(this, 'setElementInternal', el);
  if(!this.contentElement_)
    this.contentElement_ = el;
};


mvc.Control.prototype.getContentElement = function() {
  return this.contentElement_ || goog.base(this, 'getContentElement');
};


/**
 * @param {*} model to set the model to.
 * @param {boolean=} opt_dontFire whether to suppress firing all change events.
 */
mvc.Control.prototype.setModel = function(model, opt_dontFire) {

  // if there is a previous model then unbind the listeners, but keep wrappers
  if(this.getModel())
    goog.array.forEach(goog.array.map(this.modelListeners_, function(listener) {
      return listener.id;
    }), this.unbind_, this);

  // set the model
  goog.base(this, 'setModel', model);

  // refill the wrappers
  goog.array.forEach(this.modelListeners_, function(modelSetup) {
    // get the models boundEvent
    var ret = modelSetup.fn.apply(this, modelSetup.args);
    // setup aliases
    modelSetup.bound = ret;
    modelSetup.fire = ret.fire;
    modelSetup.unbind = goog.bind(this.unbind, this, ret.id);
    modelSetup.id = ret.id;
    // fire the listeners
    if (!opt_dontFire && !goog.array.contains(
        [this.bindAdd_,
        this.bindRemove_,
        this.bindUnload_], modelSetup.fn))
      modelSetup.fire();
  }, this);
};


/**
 * this will refresh the list whenever there is a change
 * 
 * @param {function(new:mvc.Control, mvc.Model): undefined} type control to use.
 * @param {Element=} opt_listEl for the list to be put under.
 * @param {Function=} opt_callback to be run once done.
 * @return {{fire: Function, id: number, unbind: Function}} boundEvent object.
 */
mvc.Control.prototype.autolist = function(type, opt_listEl, opt_callback) {
  if(opt_listEl)
    this.contentElement_ = opt_listEl;
  return this.modelChange(goog.bind(this.autolist_, this, type, opt_callback))
    .fire();
};


mvc.Control.prototype.autolist_ = function(type, opt_callback) {
  var model = this.getModel();
  var models = model.getModels();
  var children = this.children_ || [];
  var childModels = goog.array.map(children, function(child) {
    return child.getModel();
  });

  var removed = goog.array.filter(children, function(child) {
    return !goog.array.contains(models, child.getModel());
  });
  if (children.length == 0) {
    goog.array.forEach(models, function(model) {
      var newChild = new type(model);
      this.addChild(newChild, true);
    }, this);
  } else {
    goog.array.forEach(removed, function(child) {
      this.removeChild(child, true);
      child.dispose();
    }, this);
    goog.array.forEach(models, function(model, ind) {
      if(!goog.array.contains(childModels, model)) {
        var child = new type(model);
        child.createDom();
        this.addChildAt(child, ind, true);
      } else {
        child = goog.array.find(children, function(c) {
          return c.getModel() == model;
        });
        if (this.getChildAt(ind) != child)
          this.addChildAt(child, ind);
      }
    
    }, this);
  }
  opt_callback && opt_callback.call(this, this.getContentElement());
};


mvc.Control.prototype.autobindChange_ = function(handle, selector) {
  var args = goog.array.slice(arguments, 2);
  var first = args[0];
  if(handle.template) {
    var data = {};
    if(handle.data) {
      goog.object.forEach(handle.data, function(val, key) {
        data[key] = goog.isFunction(val) ? val(this) : val;
      }, this);
    }
    data.model = this.getModel().get(handle.reqs);
    var html = handle.template(data);
    goog.array.forEach(this.getEls(selector), function(el) {
      if (el.tagName == 'INPUT' && el.getAttribute('type') != 'checkbox') {
        if (el.value != html) {
          el.value = html;
        }
      } else if (el.tagName == 'SELECT') {
        goog.array.forEach(el.options, function(opt) {
          opt.selected = (opt.value == html)
        });
      } else {
        goog.dom.removeChildren(el);
        goog.dom.append(el, goog.dom.htmlToDocumentFragment(html));
      }
    }, this);
  }
  if (!handle.noCheck)
    goog.array.forEach(this.getEls(selector), function(el) {
      if (el.tagName == 'INPUT' && el.getAttribute('type') == 'checkbox') {
        el.checked = !!this.getModel().get(handle.reqs[0]);
      } 
    }, this);
  if (goog.isDef(handle.onClass)) {
    var onClass = handle.onClass;
    goog.array.forEach(this.getEls(selector), function(el) {
        goog.dom.classes.enable(el, onClass,
            first && first.length !== 0);
        if(handle.offClass)
          goog.dom.classes.enable(el, handle.offClass,
              !first || first.length === 0);
    });
  }
  if (handle.reqClass) {
    if (goog.isArray(handle.reqClass))
      goog.array.forEach(this.getEls(selector), function(el) {
          goog.array.forEach(handle.reqClass, function(className) {
            goog.dom.classes.enable(el, className,
              className == handle.chooseClass(first));
          }, this);
      }, this);
    else
      goog.array.forEach(this.getEls(selector), function(el) {
          goog.object.forEach(handle.reqClass, function(val, key) {
            goog.dom.classes.enable(el, val,
              key == handle.chooseClass(first));
          }, this);
      }, this);
  }
  if (handle.show) {
    goog.array.forEach(this.getEls(selector), function(el) {
      goog.style.showElement(el, handle.show(first));
    });
  };
  if (handle.attr) {
    var obj = {};
    obj[handle.attr] = this.getModel().get(handle.reqs[0]);
    goog.array.forEach(this.getEls(selector), function(el) {
      if(goog.isDef(obj[handle.attr]))
        goog.dom.setProperties(el, obj);
      else
        el.removeAttribute(handle.attr);
    });
  };
  if (handle.then) {
    handle.then.apply(this, goog.array.map(handle.reqs, function(key) {
      return this.getModel().get('key');
    }, this));
  }
};


/**
 * sets up two way binding based on a class selector and template or handle
 * 
 * @param {string|Array} selector must be class only for two way binding.
 * @param {string|Object} handle string for a template in the form:
 *
 * {$attribute} with some text and a {$attribute2} second attribute
 *
 * otherwise a function that takes in an object. Attributes from the model will
 * be namespaced under model (to get around advanced optimizations) if you are
 * using soy then you can get the attribute with {$model['attribute']}.
 * You can create a button like object by passing in an onClass and offClass
 * that will toggle those classes and a models boolean attribute on click.
 * Also you can pass in reqClass to toggle between several classes based on a
 * value with chooseClass being the function thatcan convert the first required
 * attribute to the class value in reqClass or no function if the values match.
 * Pass in noClick and/or noBlur as true to disable the click or blur binding.
 * Pass in show as the attribute to show or hide on a truthy value or just as
 * true to use the first attribute in reqs.
 * @param {boolean=} opt_fire don't hook up the setting of attributes.
 * @return {{fire: Function, id: number, unbind: Function}} boundEvent object.
 */
mvc.Control.prototype.autobind = function(selector, handle, opt_fire) {
  if(goog.isString(handle)) {
    handle = {
      template: handle
    };
  }
  if(opt_fire) {
    goog.object.extend(handle, {
      noClick: true,
      noBlur: true
    });
  }
  if(goog.isString(handle.template)) {
    var str = handle.template;
    var req = str.match(/\{\$([^}]*)\}/g) || [];
    req = goog.array.map(req, function(match) {
      return match.substring(2, match.length - 1);
    });
    handle.template = function(data) {
        var output = str;
        goog.object.forEach(data.model, function(val, key) {
          var regex = new RegExp('\\{\\$' + key + '\\}', 'g');
          output = output.replace(regex, val);
        });
        return output;
      };
    handle.reqs = handle.reqs || [];
    goog.array.extend(handle.reqs, req);
    goog.array.removeDuplicates(handle.reqs);
  }
  if (handle.reqClass) {
    if (!handle.chooseClass) {
      handle.chooseClass = function(value) {
        return value;
      };
    }
    if (goog.isString(handle.reqClass)) {
      handle.reqClass = [handle.reqClass];
    }
  }
  if (handle.show) {
    if (!handle.reqs)
      handle.reqs = [];
    if(goog.isString(handle.show)) {
      goog.array.insertAt(handle.reqs, handle.show, 0);
    }
    if(!goog.isFunction(handle.show))
      handle.show = function(show) {return show;};
  }
  if(!goog.isArray(handle.reqs))
    handle.reqs = [handle.reqs];
  var blurs = [];
  if (!goog.isDef(handle.noBlur)) {
    blurs.push(this.on(goog.events.EventType.BLUR, function(e) {
      if(e.target.tagName == 'INPUT' &&
          e.target.getAttribute('type') == 'text')
        this.getModel().set(handle.reqs[0], e.target.value);
      else if(e.target.tagName == 'SELECT') {
        this.getModel().set(handle.reqs[0],
            e.target.options[e.target.selectedIndex].value);
      }
    }, selector));
  }
  if (!goog.isDef(handle.noClick)) {
    blurs.push(this.click(function(e) {
      if (handle.onClass) {
        this.getModel().set(handle.reqs[0],
            !goog.dom.classes.has(e.target, handle.onClass));
        if (handle.stop)
          e.stopPropagation();
      } else if(e.target.tagName == 'INPUT' &&
          e.target.getAttribute('type') == 'checkbox') {
        this.getModel().set(handle.reqs[0], e.target.checked);
        if (handle.stop)
          e.stopPropagation();
      }
    }, selector, this, 30));
  }
  
  var that = this;
  var setHTML = function() {
    this.autobindChange_.apply(this,
        goog.array.concat([handle, selector], goog.array.clone(arguments)));
  };
  var bound = this.bind(handle.reqs, setHTML).fire();
  var ret = {
    id: goog.getUid(blurs),
    blurs: blurs,
    bound: bound,
    fire: bound.fire,
    unbind: goog.bind(function() {
      this.unbind(goog.getUid(blurs));
    }, this)
  };
  this.autoBinders_.push(ret);
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
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.bind = function(name, fn, opt_handler) {
  return this.setupBoundEvent_(this.bind_, goog.array.slice(arguments, 0));
};


/**
 * Allows easy binding of a model's attribute to an element or a function.
 * bind('name', function(value), handler) allows you to run a function and
 * optionally bind it to the handler. You can also pass in an array of names
 * to listen for a change on any of the attributes.
 *
 * @private
 * @param {Array|string} name of attributes to listen to.
 * @param {Function} fn function to run when change.
 * @param {Object=} opt_handler object for 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.bind_ = function(name, fn, opt_handler) {
  return this.getModel().bind(name, fn, opt_handler || this);
};



/**
 * bind to any change event
 *
 * @param {Function} fn function to bind.
 * @param {Object=} opt_handler object to bind 'this' to.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.bindAll = function(fn, opt_handler) {
  return this.setupBoundEvent_(this.bindAll_, goog.array.slice(arguments, 0));
};


/**
 * bind to any change event
 *
 * @private
 * @param {Function} fn function to bind.
 * @param {Object=} opt_handler object to bind 'this' to.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.bindAll_ = function(fn, opt_handler) {
  return this.getModel().bindAll(fn, opt_handler || this);
};


/**
 * bind to any change event
 *
 * @param {Function} fn function to bind.
 * @param {Object=} opt_handler object to bind 'this' to.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.bindAdd = function(fn, opt_handler) {
  return this.setupBoundEvent_(this.bindAdd_, goog.array.slice(arguments, 0));
};


/**
 * bind to any change event
 *
 * @private
 * @param {Function} fn function to bind.
 * @param {Object=} opt_handler object to bind 'this' to.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.bindAdd_ = function(fn, opt_handler) {
  return this.getModel().bindAdd(fn, opt_handler || this);
};


/**
 * bind to any change event
 *
 * @param {Function} fn function to bind.
 * @param {Object=} opt_handler object to bind 'this' to.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.bindRemove = function(fn, opt_handler) {
  return this.setupBoundEvent_(this.bindRemove_, goog.array.slice(arguments, 0));
};


/**
 * bind to any change event
 *
 * @private
 * @param {Function} fn function to bind.
 * @param {Object=} opt_handler object to bind 'this' to.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.bindRemove_ = function(fn, opt_handler) {
  return this.getModel().bindRemove(fn, opt_handler || this);
};


/**
 * @param {Function} fn function to run when model is disposed.
 * @param {Object=} opt_handler object for 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.bindUnload = function(fn, opt_handler) {
  return this.setupBoundEvent_(this.bindUnload_, goog.array.slice(arguments, 0));
};


/**
 * @private
 * @param {Function} fn function to run when model is disposed.
 * @param {Object=} opt_handler object for 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.bindUnload_ = function(fn, opt_handler) {
  return this.getModel().bindUnload(fn, opt_handler || this);
};


/**
 * creates a wrapper around the boundEvent
 * 
 * @param {Function} fn the function the wrapper should call.
 * @param {Array=} opt_args arguments to pass it.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.setupBoundEvent_ = function(fn, opt_args) {
  var id = fn.apply(this, opt_args || []);

  var ret = {
    id: id.id,
    bound: id,
    fire: id.fire,
    unbind: goog.bind(this.unbind, this, id.id),
    fn: fn,
    args: opt_args || []
  };
  
  this.modelListeners_.push(ret);

  return ret;
}


/**
 * use this to bind functions to a change in any of the collections models
 *
 * @param {Function} fn function to run on model change.
 * @param {Object=} opt_handler to set 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.anyModelChange = function(fn, opt_handler) {
  return this.setupBoundEvent_(this.anyModelChange_,
      goog.array.slice(arguments, 0));
};


/**
 * use this to bind functions to a change in any of the collections models
 *
 * @private
 * @param {Function} fn function to run on model change.
 * @param {Object=} opt_handler to set 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.anyModelChange_ = function(fn, opt_handler) {
  return this.getModel().anyModelChange(fn, opt_handler || this);
};

/**
 * use this to bind functions to a change in any of the collections models
 *
 * @param {Function} fn function to run on model change.
 * @param {Object=} opt_handler to set 'this' of function.
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.modelChange = function(fn, opt_handler) {
  return this.setupBoundEvent_(this.modelChange_,
      goog.array.slice(arguments, 0));
};


/**
 * use this to bind functions to a change in any of the collections models
 *
 * @private
 * @param {Function} fn function to run on model change.
 * @param {Object=} opt_handler to set 'this' of function
 * @return {{fire: Function, id: number, unbind: Function}} bind object.
 */
mvc.Control.prototype.modelChange_ = function(fn, opt_handler) {
  return this.getModel().modelChange(fn, opt_handler || this);
};


/**
 * unbind a listener by id
 *
 * @param {number|Object} id returned form bind or bindall.
 * @return {boolean} if found and removed.
 */
mvc.Control.prototype.unbind = function(id) {
  goog.array.removeIf(this.modelListeners_, function(listener) {
    if (goog.isObject(listener))
      listener = listener.id;
    return listener == (id.id || id);
  });
  var auto = goog.array.find(this.autoBinders_, function(bound) {
    return bound.id == (id.id || id);
  });
  if(auto) {
    goog.array.forEach(auto.blurs, function(blur) {
      this.off(blur);
    }, this);
    id = auto.bound;
  }
  goog.array.remove(this.autoBinders_, auto);
  return this.unbind_(id);
};


/**
 * unbind a listener by id
 *
 * @private
 * @param {number|Object} id returned from bind or bindall.
 * @return {boolean} if found and removed.
 */
mvc.Control.prototype.unbind_ = function(id) {
  if (goog.isObject(id))
    id = id;
  return this.getModel().unbind(id);
};


/**
 * @inheritDoc
 */
mvc.Control.prototype.disposeInternal = function() {
  goog.array.forEach(goog.array.clone(this.modelListeners_), function(id) {
    id.unbind();
  }, this);
  goog.array.forEach(goog.array.clone(this.autoBinders_), function(bound) {
    bound.unbind();
  });
  goog.base(this, 'disposeInternal');
  this.eventHolder_ = null;
};



