//     (c) 2012 Rhys Brett-Bowen, Catch.com
//     goog.mvc may be freely distributed under the MIT license.
//     For all details and documentation:
//     https://github.com/rhysbrettbowen/goog.mvc

goog.provide('mvc.Mediator');

goog.require('goog.array');
goog.require('goog.object');



/**
 * @constructor
 * @param {{split: string, wild: string, wildlvl: string}=} opt_options 
 * to define options.
 */
mvc.Mediator = function(opt_options) {
  /** @private */
  this.available_ = {};
  /** @private */
  this.listeners_ = {};
  if (opt_options) {
    this.split_ = opt_options.split || this.split_;
    this.wild_ = opt_options.wild || this.wild_;
    this.wildlvl_ = opt_options.wildlvl || this.wildlvl_;
  }
  this.wildRegex_ = new RegExp(
      goog.string.regExpEscape(goog.string.regExpEscape(this.wild_)), 'gi');
  this.wildlvlRegex_ = new RegExp(
      goog.string.regExpEscape(goog.string.regExpEscape(this.wildlvl_)), 'gi');
};


/**
 * the character or string to define hierarchy.
 * 
 * @private
 * @type {string}
 */
mvc.Mediator.prototype.split_ = '.';


/**
 * the character or string to denote a wild card
 *
 * @private
 * @type {string}
 */
mvc.Mediator.prototype.wild_ = '*';

/**
 * the character or string to denote a wild card
 *
 * @private
 * @type {string}
 */
mvc.Mediator.prototype.wildlvl_ = '%';

/**
 * lets components know that a message can be fired by an object.
 *
 * @param {Object} obj to register.
 * @param {string|Array.<string>} messages that the object can broadcast.
 * @param {boolean=} opt_noBroadcast don't add broadcast to object.
 */
mvc.Mediator.prototype.register = function(obj, messages, opt_noBroadcast) {

  if(!obj.broadcast && !opt_noBroadcast) {
    obj.broadcast = goog.bind(this.broadcast, this);
  }

  if(!goog.isArrayLike(messages))
    messages = [messages];
  // each message we save the object reference in an array so we know it
  // can provide that message
  goog.array.forEach(/** @type {Array} */(messages), function(message) {
    this.available_[message] = this.available_[message] || [];
    goog.array.insert(this.available_[message], obj);

    // if we registered any listeners for a message that can now start we
    // fire it with the object
    if (this.available_[message].length == 1) {
      goog.object.forEach(this.listeners_, function(val, key) {
        goog.array.forEach(val, function(listener) {
          if (!listener.initDone &&
              this.canFire_(key, message)) {
            listener.initDone = true;
            listener.disDone = false;
            if(listener.init)
              listener.init([obj]);
          }
        }, this);
      }, this);
    }
  }, this);
};


/**
 * checks to see if the first param is fired by the message.
 * 
 * @param {string} key the listeners key.
 * @param {string} message that was fired.
 * @return {boolean} whether it's a match.
 */
mvc.Mediator.prototype.matchMessage_ = function(key, message) {
  // escape for regex
  key = goog.string.regExpEscape(key);
  // change wildcards to regex
  key = key.replace(this.wildRegex_, '.*')
      .replace(this.wildlvlRegex_, '[^' + this.split_ + ']*');
  return !!message.match(new RegExp('^' + key + '$', 'i'));
};


/**
 * checks to see if there is an availble listener for the key.
 * 
 * @param {string} key to be broadcast.
 * @return {boolean} whether there is a match.
 */
mvc.Mediator.prototype.canFireAvailable_ = function(key) {
  return goog.array.some(goog.object.getKeys(this.available_),
      goog.bind(this.canFire_, this, key));
};


/**
 * if a message is registered could a key match it.
 *
 * @param {string} message to check.
 * @param {string} key to register.
 * @return {boolean} if a submessage of message could match key.
 */
mvc.Mediator.prototype.canFire_ = function(key, message) {
  var wildInd = key.indexOf(this.wild_);
  var keyArr;
  var messageArr;
  if (wildInd > -1)
    keyArr = key.substring(0, wildInd);
  keyArr = key.split(this.split_);
  messageArr = message.split(this.split_);
  return goog.array.every(messageArr, function(part, ind) {
    if(!keyArr[ind])
      return true;
    var regex = new RegExp(
        '^' + goog.string.regExpEscape(keyArr[ind])
            .replace(this.wildlvlRegex_, '.*') + '$', 'i')
    if(part.match(regex))
      return true;
    else if (wildInd > -1 && part.match(regex))
      return true;
    return false;
  }, this);
};


/**
 * removes the object from the register for that message
 *
 * @param {Object} obj to unregister.
 * @param {Array.<string>|string=} opt_messages an array of message to 
 * unregister the object from being able to broadcast, or undefined to
 * unregister from all.
 */
mvc.Mediator.prototype.unregister = function(obj, opt_messages) {
  var messages = opt_messages || [];
  if(opt_messages && !goog.isArrayLike(opt_messages))
    messages = [opt_messages];

  // remove the object from all available
  goog.object.forEach(this.available_, function(val, message) {

    // if it's not in the messages to remove then skip
    if (opt_messages &&
        !goog.array.find(/** @type {Array} */(messages), function(opt) {
          return opt.toLowerCase() ==
              message.substring(0, opt.length).toLowerCase() &&
              (message.length == opt.length ||
              message.charAt(opt.length) == this.split_);
        }, this)
    )
      return;
    // remove from the array
    goog.array.remove(val, obj);
  }, this);

  // cleanup the available object
  var check = [];
  goog.object.forEach(this.available_, function(val, message) {
    if (val.length > 0) {
      return;
    }
    check.push(message);
  });
  goog.array.forEach(check, function(message) {
    delete this.available_[message];
  }, this);

  // check for listeners that should be disposed
  goog.object.forEach(this.listeners_, function(list, key) {
    if (this.canFireAvailable_(key))
      return;
    goog.array.forEach(list.slice(), function(listener) {
      if (!listener.disDone) {
        listener.disDone = true;
        if(listener.dispose)
          listener.dispose(listener.initDone);
        listener.initDone = false;
      }
    });
  }, this);
};


/**
 * the message to listen for and the handler. Can either be a function to run
 * or an object of the type: {init:Function, fn:Function, dispose:Function}
 * which will run init when the message becomes available and dispose when
 * a message is no longer supported. Returns a uid that can be used with
 * off to remove the listener
 *
 * @param {string|Array.<string>} message (s) to listen to.
 * @param {Function|Object} fn to run on message or object of functions to run
 * that can include init, fn and dispose.
 * @param {Object=} opt_handler to use as 'this' for the function.
 * @return {?number} the id to pass to off method.
 */
mvc.Mediator.prototype.on = function(message, fn, opt_handler) {
  if (goog.isArrayLike(message)) {
    goog.array.forEach(/** @type {Array} */(message), function(mess) {
      this.on(mess, fn, opt_handler);
    }, this);
    return null;
  }
  if (goog.isFunction(fn)) {
    fn = {fn: fn};
  }
  if (fn.fn)
    fn.fn = goog.bind(fn.fn, opt_handler || this);
  if (fn.init)
    fn.init = goog.bind(fn.init, opt_handler || this);
  if (fn.dispose)
    fn.dispose = goog.bind(fn.dispose, opt_handler || this);
  this.listeners_[message] = this.listeners_[message] || [];
  if (!this.listeners_[message].length) {
    if (fn.init && this.available_[message]) {
      fn.init(this.available_[message][0]);
    }
  }
  fn.id = opt_handler || this;
  goog.array.insert(this.listeners_[message],
      fn);
  return goog.getUid(fn);
};


/**
 * this will only run the function the first time the message is given
 *
 * @param {string} message to listen to.
 * @param {Function} handler the function to run on a message.
 * @param {Object=} opt_handler to use as 'this' for the function.
 * @return {number} the id to pass to off method.
 */
mvc.Mediator.prototype.once = function(message, handler, opt_handler) {
  var uid;
  var fn = goog.bind(function() {
    handler.apply(opt_handler || this, goog.array.slice(arguments, 0));
    this.off(uid);
  },this);
  uid = this.on(message, fn);
  return /** @type {number} */(uid);
};


/**
 * return the listener by id.
 * 
 * @param {number} id id of the listener (from on).
 * @return {?Object} the found listener.
 */
mvc.Mediator.prototype.getById = function(id) {
  var ret;
  goog.object.forEach(this.listeners_, function(listeners) {
    ret = ret || goog.array.find(listeners, function(listener) {
      return goog.getUid(listener) == id;
    })
  });
  return ret;
};


/**
 * if the init function has been run and not disposed.
 * 
 * @param {number} id id of the listener (from on).
 * @return {?boolean}
 */
mvc.Mediator.prototype.isInit = function(id) {
  var ret = this.getById(id);
  return ret && ret.initDone;
};


/**
 * if the listener has been disposed and not re-inited
 * 
 * @param {number} id id of the listener (from on).
 * @return {?boolean}
 */
mvc.Mediator.prototype.isDisposed = function(id) {
  var ret = this.getById(id);
  return ret && ret.disDone;
};


/**
 * remove the listener by it's id
 *
 * @param {Object} uid of the listener to turn off.
 */
mvc.Mediator.prototype.off = function(uid) {
  var ret = false;
  var rem = [];
  goog.object.forEach(this.listeners_, function(listener, key) {
    while(goog.array.removeIf(listener, function(el) {
      return goog.getUid(el) == uid || el.id == uid;
    })) {}
    if(!listener.length)
      rem.push(key);
  });
  goog.array.forEach(rem, function(key) {
    delete this.listeners_[key];
  }, this);
  return ret;
};


/**
 * check to see if anyone is listening for a message
 *
 * @param {string} message the message to test.
 * @return {boolean} whether the message has at least one listener.
 */
mvc.Mediator.prototype.isListened = function(message) {
  var isListen = false;
  goog.object.forEach(this.listeners_, function(val, key) {
    isListen = isListen || (val.length && this.matchMessage_(key, message));
  }, this);
  return isListen;
};


/**
 * broadcast the message to the listeners
 *
 * @param {string} message to broadcast.
 * @param {*=} opt_args arguments to pass to listener functions.
 */
mvc.Mediator.prototype.broadcast = function(message, opt_args) {
  goog.object.forEach(this.listeners_, function(listeners, key) {
    if (!this.matchMessage_(key, message))
      return;
    goog.array.forEach(listeners.slice(), function(listener) {
      if (goog.isFunction(listener)) {
        listener(opt_args, message);
      } else if (listener.fn) {
        listener.fn(opt_args, message);
      }
    });
  }, this);
};


/**
 * reset the mediator to it's original state
 */
mvc.Mediator.prototype.reset = function() {
  this.available_ = {};
  goog.object.forEach(this.listeners_, function(listener) {
    goog.array.forEach(listener, function(l) {
      if (l.dispose)
        l.dispose();
    });
  });
  this.listeners_ = {};
};
