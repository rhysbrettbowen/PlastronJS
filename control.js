//     (c) 2012 Rhys Brett-Bowen, Catch.com
//     goog.mvc may be freely distributed under the MIT license.
//     For all details and documentation:
//     https://github.com/rhysbrettbowen/goog.mvc

goog.provide('mvc.Control');

goog.require('goog.dom');
goog.require('goog.object');
goog.require('goog.ui.Component');



/**
 * instantiate with a mvc.Model
 *
 * @constructor
 * @param {mvc.Model} model to link with the control.
 * @extends {goog.ui.Component}
 */
mvc.Control = function(model) {
  mvc.Control.superClass_.constructor.apply(
      this, goog.array.slice(arguments, 1));
  this.eventHolder_ = {
    listeners: {},
    handlers: {}
  };
  this.modelListeners_ = [];
  this.autoBinders_ = [];
  this.setModel(model);
  this.contentElement_ = null;
};
goog.inherits(mvc.Control, goog.ui.Component);


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
  goog.inherits(mvc.Control, base);
  goog.object.extend(mvc.Control.prototype, proto);

  opt_call = opt_call || mvc.Control;

  /** @constructor */
  var temp = function() {};
  temp.prototype = opt_call.prototype;
  control = new temp();
  opt_call.apply(control, args);

  goog.inherits(mvc.Control, goog.ui.Component);
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
 * @param {mvc.Model} model to set the model to.
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
 * remove the element and dispose
 */
mvc.Control.prototype.remove = function() {
  goog.dom.removeNode(this.getElement());
  this.dispose();
};


/**
 * Internal use. Handles and delegates events
 *
 * @private
 * @param {string} type of event.
 * @param {Event} e the original event.
 */
mvc.Control.prototype.handleEvents_ = function(type, e) {
  if (!this.eventHolder_.handlers[type])
    return;

  // go through handlers in order and stop if propagation stopped
  goog.array.forEach(this.eventHolder_.handlers[type], function(handler) {
    if (e.propagationStopped_) {
      return;
    }

    // if no selector or matches selector then fire
    if (!handler.selectors.length ||
            goog.array.some(handler.selectors, function(selector) {
          if (goog.isFunction(selector))
            return selector(e);
          var ret =  goog.array.find(this.getEls(selector), function(el) {
            return goog.dom.contains(el, /** @type {Node} */(e.target));
          });
          if (ret)
            e.target = /** @type {EventTarget} */(ret);
          return ret;
            }, this)) {
      goog.bind(handler.fn, handler.handler)(e);
      if(handler.stop)
        e.stopPropagation();
    }
  }, this);
};


/**
 * delegating events. An event type is needed as well as a handling function.
 * if a third parameter is passed then elements with that class will be
 * listened to, otherwise the whole component. Returns a uid that can be used
 * to end the listener with the off method
 *
 * @param {string} eventName the event type to listen for.
 * @param {Function} fn the function to run on the event.
 * @param {string|Array.<string>|Function=} opt_className or names to
 * check element against to see if listener function should fire. if it is
 * a function then it takes the event and returns true if it matches.
 * @param {Object=} opt_handler object to bind 'this' to, otherwise mvc.Control.
 * @param {number=} opt_priority default is 50, lower is more important.
 * @param {boolean=} opt_stop whether to stop propogation.
 * @return {{fire: Function, id: number, off: Function}} boundEvent object.
 */
mvc.Control.prototype.on = function(
    eventName, fn, opt_className, opt_handler, opt_priority, opt_stop) {

  var capture = ['blur', 'focus'];

  // initialize
  if (!this.eventHolder_) {
    this.eventHolder_ = {
      listeners: {},
      handlers: {}
    };
  }
  if (!this.eventHolder_.handlers[eventName]) {
    this.eventHolder_.handlers[eventName] = [];
  }
  if (!this.eventHolder_.listeners[eventName]) {
    this.eventHolder_.listeners[eventName] = this.getHandler().listen(
        this.getElement(), eventName,
        goog.bind(this.handleEvents_, this, eventName),
        goog.array.contains(capture, eventName));
  }
  if (!goog.isDef(opt_className)) {
    opt_className = [];
  }

  var obj = {
    selectors: (goog.isArray(opt_className) ?
        opt_className : [opt_className]),
    fn: fn,
    uid: null,
    handler: (opt_handler || this),
    priority: (opt_priority || 50),
    stop: opt_stop
  };
  obj.uid = goog.getUid(obj);

  // insert in array based on priority
  goog.array.insertAt(this.eventHolder_.handlers[eventName], obj,
      goog.array.findIndexRight(this.eventHolder_.handlers[eventName],
      function(obj) {
            return obj.priority <= (opt_priority || 50);
      }
      ) + 1);
  var ret = {
    fire: goog.bind(function(opt_target) {
      var target = this.getElement();
      if(opt_target)
        target = opt_target;
      fn.call(opt_handler || this, new goog.events.Event(eventName, target));
      return ret;
    }, this),
    id: obj.uid,
    off: goog.bind(this.off, this, obj.uid)
  };
  return ret;
};


/**
 * same as on, but will only fire once
 *
 * @param {string} eventName the event type to listen for.
 * @param {Function} fn the function to run on the event.
 * @param {string|Array.<string>|Function=} opt_className or names to
 * check element against to see if listener function should fire.if it is
 * a function then it takes the event and returns true if it matches.
 * @param {Object=} opt_handler object to bind 'this' to, otherwise mvc.Control.
 * @param {number=} opt_priority default is 20, lower is more important.
 * @param {boolean=} opt_stop whether to stop propogation.
 * @return {{fire: Function, id: number, off: Function}} boundEvent object.
 */
mvc.Control.prototype.once = function(
    eventName, fn, opt_className, opt_handler, opt_priority, opt_stop) {
  var uid;
  var onceFn = function() {
    fn.apply(/** @type {Object} */(opt_handler || this),
        Array.prototype.slice.call(arguments));
    uid.off();
  };
  if(!opt_priority)
    opt_priority = 20;
  uid = this.on(
      eventName, onceFn, opt_className, opt_handler, opt_priority, opt_stop);
  return uid;
};


/**
 * same as on but assumes the event type is a click
 *
 * @param {Function} fn the function to run on the event.
 * @param {string|Array.<string>|Function=} opt_className or names to
 * check element against to see if listener function should fire. if it is
 * a function then it takes the event and returns true if it matches.
 * @param {Object=} opt_handler object to bind 'this' to, otherwise mvc.Control.
 * @param {number=} opt_priority default is 50, lower is more important.
 * @param {boolean=} opt_stop whether to stop propogation.
 * @return {{fire: Function, id: number, off: Function}} boundEvent object.
 */
mvc.Control.prototype.click = function(
    fn, opt_className, opt_handler, opt_priority, opt_stop) {
  return this.on(goog.events.EventType.CLICK,
      fn, opt_className, opt_handler, opt_priority, opt_stop);
};


/**
 * take off a lister by it's id
 *
 * @param {Object|string} uid of event listener to turn off.
 */
mvc.Control.prototype.off = function(uid) {
  if(goog.isObject(uid) && uid.id)
    uid = uid.id;
  goog.object.forEach(this.eventHolder_.handlers, function(val, key) {
    goog.array.removeIf(val, function(handler) {
      return handler.uid == uid;
    });
  });
};


/**
 * pass in a string like "#elementId", ".className" or "tagName[ .className]"
 * to get array of elements with the id, class or tag and class name
 *
 * @param {string|Array} selector string to use to find elements.
 * @param {Node=} opt_parent optional parent else the control's element.
 * @return {?goog.array.ArrayLike} elements found.
 */
mvc.Control.prototype.getEls = function(selector, opt_parent) {
  opt_parent = opt_parent || this.getElement();
  if (!selector)
    return [opt_parent];
  if(goog.isArray(selector)) {
    var arr = goog.array.flatten(
        goog.array.map(selector, this.getEls, this));
    goog.array.removeDuplicates(arr);
    return arr;
  }
  if (selector.charAt(0) == '-')
    selector = '.' + selector.substring(1);
  if (selector.charAt(0) == '.') {
    return goog.dom.getElementsByClass(selector.substring(1),
        /** @type {Element} */(opt_parent)) || [];
  }
  if (selector.charAt(0) == '#') {
    return [goog.dom.getElement(selector.substring(1))];
  }
  return goog.array.clone(
      goog.dom.getElementsByTagNameAndClass(goog.string.trim(
          selector.replace(/\..*/, '')),
          selector.indexOf('.') > 0 ? selector.replace(/.*\./, '') : null,
          /** @type {Element} */(opt_parent)));
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
  var fn = function() {
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
  return this.modelChange(fn).fire();
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
    if(goog.isString(handle.show))
      goog.array.insertAt(handle.reqs, handle.show, 0);
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
      if(handle.onClass) {
        this.getModel().set(handle.reqs[0],
            !goog.dom.classes.has(e.target, handle.onClass));
        e.stopPropagation();
      } else if(e.target.tagName == 'INPUT' &&
          e.target.getAttribute('type') == 'checkbox') {
        this.getModel().set(handle.reqs[0], e.target.checked);
        e.stopPropagation();
      }
    }, selector, this, 30));
  }
  

  var setHTML = function() {
    var args = goog.array.slice(arguments, 0);
    var first = args[0];
    if(handle.template) {
      var data = {};
      if(handle.data) {
        goog.object.forEach(handle.data, function(val, key) {
          data[key] = goog.isFunction(val) ? val(this) : key;
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
    goog.array.forEach(this.getEls(selector), function(el) {
      if (el.tagName == 'INPUT' && el.getAttribute('type') == 'checkbox') {
        el.checked = this.getModel().get(handle.reqs[0]);
      } 
    }, this);
    if (goog.isDef(handle.onClass)) {
      var onClass = handle.onClass;
      goog.array.forEach(this.getEls(selector), function(el) {
          goog.dom.classes.enable(el, onClass, first);
          if(handle.offClass)
            goog.dom.classes.enable(el, handle.offClass, !first);
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
        goog.style.showElement(el, first);
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
  goog.array.forEach(this.modelListeners_, function(id) {
    id.unbind();
  }, this);
  this.eventHolder_ = null;
  goog.base(this, 'disposeInternal');
};

