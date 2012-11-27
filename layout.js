//     (c) 2012 Rhys Brett-Bowen, Catch.com
//     goog.mvc may be freely distributed under the MIT license.
//     For all details and documentation:
//     https://github.com/rhysbrettbowen/goog.mvc

goog.provide('mvc.Layout');

goog.require('goog.dom');
goog.require('goog.object');
goog.require('goog.ui.Component');



/**
 * instantiate with a mvc.Model
 *
 * @constructor
 * @extends {goog.ui.Component}
 */
mvc.Layout = function() {
  mvc.Layout.superClass_.constructor.apply(
      this, goog.array.slice(arguments, 0));
  this.eventHolder_ = {
    listeners: {},
    handlers: {}
  };
};
goog.inherits(mvc.Layout, goog.ui.Component);


/**
 * remove the element and dispose
 */
mvc.Layout.prototype.remove = function() {
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
mvc.Layout.prototype.handleEvents_ = function(type, e) {
  if (!this.eventHolder_.handlers[type])
    return;

  var target = e.target;
  // go through handlers in order and stop if propagation stopped
  goog.array.forEach(this.eventHolder_.handlers[type], function(handler) {
    e.target = target;
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
 * @param {Object=} opt_handler object to bind 'this' to, otherwise mvc.Layout.
 * @param {number=} opt_priority default is 50, lower is more important.
 * @param {boolean=} opt_stop whether to stop propogation.
 * @return {{fire: Function, id: number, off: Function}} boundEvent object.
 */
mvc.Layout.prototype.on = function(
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
 * @param {Object=} opt_handler object to bind 'this' to, otherwise mvc.Layout.
 * @param {number=} opt_priority default is 20, lower is more important.
 * @param {boolean=} opt_stop whether to stop propogation.
 * @return {{fire: Function, id: number, off: Function}} boundEvent object.
 */
mvc.Layout.prototype.once = function(
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
 * @param {Object=} opt_handler object to bind 'this' to, otherwise mvc.Layout.
 * @param {number=} opt_priority default is 50, lower is more important.
 * @param {boolean=} opt_stop whether to stop propogation.
 * @return {{fire: Function, id: number, off: Function}} boundEvent object.
 */
mvc.Layout.prototype.click = function(
    fn, opt_className, opt_handler, opt_priority, opt_stop) {
  return this.on(goog.events.EventType.CLICK,
      fn, opt_className, opt_handler, opt_priority, opt_stop);
};


/**
 * take off a lister by it's id
 *
 * @param {Object|string} uid of event listener to turn off.
 */
mvc.Layout.prototype.off = function(uid) {
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
mvc.Layout.prototype.getEls = function(selector, opt_parent) {
  opt_parent = opt_parent || this.getElement();
  if (!selector)
    return [opt_parent];
  if(goog.isArray(selector)) {
    var arr = goog.array.flatten(
        goog.array.map(selector, function(select) {
          return this.getEls(select);
        }, this));
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
 * @inheritDoc
 */
mvc.Layout.prototype.addChildAt = function(
    child, index, opt_render) {
  if (goog.userAgent.IE && !goog.userAgent.isVersion(9)) {
    goog.base(this, 'addChildAt', child, index, opt_render);
    return;
  }
  if (child.inDocument_ && (opt_render || !this.inDocument_)) {
    throw Error(goog.ui.Component.Error.ALREADY_RENDERED);
  }

  if (index < 0 || index > this.getChildCount()) {
    throw Error(goog.ui.Component.Error.CHILD_INDEX_OUT_OF_BOUNDS);
  }

  if (!this.childIndex_ || !this.children_) {
    this.childIndex_ = {};
    this.children_ = [];
  }

  if (child.getParent() == this) {
    goog.object.set(this.childIndex_, child.getId(), child);
    goog.array.remove(this.children_, child);

  } else {
    goog.object.add(this.childIndex_, child.getId(), child);
  }

  child.setParent(this);
  goog.array.insertAt(this.children_, child, index);

  if (opt_render &&
      (!child.inDocument || !this.inDocument || child.getParent != this)) {
    if (!this.element_) {
      this.createDom();
    }
    var sibling = this.getChildAt(index + 1);
    child.render_(this.getContentElement(), sibling ? sibling.element_ : null);
  }

  if (child.inDocument_ && this.inDocument_ && child.getParent() == this) {
    var contentElement = this.getContentElement();
    if (!this.placeChild_)
      contentElement.insertBefore(child.getElement(),
         (contentElement.childNodes[index] || null));
    else
      goog.array.forEach(this.children_, function(child, index) {
        this.placeChild_(contentElement, child, index);
      }, this);



  } else if (!opt_render && this.inDocument_ && !child.inDocument_ &&
      child.element_ && child.element_.parentNode) {
    child.enterDocument();
  }
};


/**
 * @inheritDoc
 */
mvc.Layout.prototype.removeChild = function(
    child, opt_unrender) {
  var ret = goog.base(this, 'removeChild', child, opt_unrender);
  if (this.placeChild_)
    goog.array.forEach(this.children_, function(child, index) {
      this.placeChild_(this.getContentElement(), child, index);
    }, this);
  return ret;
};


/**
 * @type {?Function}
 */
mvc.Layout.prototype.placeChild_ = null;
