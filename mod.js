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

goog.provide('mvc.Mod');
goog.provide('mvc.Filter');



mvc.Mod = {

  /** @this {mvc.Mod} */
  init_: function() {
    goog.events.listen(this.collection, goog.events.EventType.CHANGE,
      this.change_, false, this);
  },

  /** @this {mvc.Mod} */
  bindUnload: function(fn, opt_handler) {
    var ret = this.collection.bind(fn, opt_handler);
  },

  /** @this {mvc.Mod} */
  bind: function(name, fn, opt_handler) {
    return this.passBind_(this.collection.bind, arguments);
  },

  /** @this {mvc.Mod} */
  bindAll: function(fn, opt_handler) {
    return this.passBind_(this.collection.bindAll, arguments);
  },

  /** @this {mvc.Mod} */
  modelChange: function(fn, opt_handler) {
    return this.passBind_(this.collection.modelChange, arguments);
  },

  /** @this {mvc.Mod} */
  anyModelChange: function(fn, opt_handler) {
    return this.passBind_(this.collection.anyModelChange, arguments);
  },

  /** @this {mvc.Mod} */
  bindAdd: function(fn, opt_handler) {
    return this.passBind_(this.collection.bindAdd, arguments);
  },

  /** @this {mvc.Mod} */
  bindRemove: function(fn, opt_handler) {
    return this.passBind_(this.collection.bindRemove, arguments);
  },

  /** @this {mvc.Mod} */
  passBind_: function(fn, args) {
    var ret = fn.apply(this.collection, args);
    this.bound_.push(ret);
    return ret;
  },

  change_: goog.nullFunction
};

mvc.Filter = {
  
  /** @this {mvc.Mod} */
  init: function(collection, filter) {
    this.filter_ = filter;
    this.collection = collection;
    this.lastFilter_ = collection.getModels(filter);
    this.modelChangeFns_ = [];
    this.init_();
  },

  /** @this {mvc.Mod} */
  getModels: function() {
    return this.collection.getModels(this.filter_);
  },

  /** @this {mvc.Mod} */
  change_: function() {
    if (!goog.array.equals(this.lastFilter_,
        goog.array.map(this.getModels(), function(model) {
          return model.cid_;
        }))) {
      goog.array.forEach(goog.array.clone(this.modelChangeFns_), function(fn) {
        fn(this);
      }, this);
    }
    this.lastFilter_ = goog.array.map(this.getModels(), function(model) {
      return model.cid_;
    });
  },

  /** @this {mvc.Mod} */
  modelChange: function(fn, opt_handler) {
    return mvc.Collection.prototype.modelChange.apply(this, arguments);
  },

  /** @this {mvc.Mod} */
  getLength: function() {
    return this.getModels().length;
  }

};
