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

goog.provide('mvc.LocalSync');

goog.require('goog.storage.Storage');
goog.require('goog.storage.mechanism.HTML5LocalStorage');
goog.require('mvc.Sync');


/**
 * @constructor
 * @implements {mvc.Sync}
 */
mvc.LocalSync = function() {
  this.store_ = new goog.storage.Storage(
      new goog.storage.mechanism.HTML5LocalStorage());
};


/**
 * @return {string} uid for object.
 */
mvc.LocalSync.prototype.getUID = function() {
  this.counter_ = this.counter_ || 0;
  return (this.counter_++) + '|' + parseInt((new Date()).getTime(), 36);
};


/**
 * @inheritDoc
 */
mvc.LocalSync.prototype.create = function(model, opt_callback) {
  var id = this.getUID();
  model.set('id', id);
  if (goog.isFunction(opt_callback)) {
    opt_callback.call(model, model);
  }
};


/**
 * @inheritDoc
 */
mvc.LocalSync.prototype.read = function(model, opt_callback) {
  model.set(/** @type {Object} */(this.store_.get(
      /** @type {string} */(model.get('id')))));
  if (goog.isFunction(opt_callback)) {
    opt_callback.call(model, model);
  }
};


/**
 * @inheritDoc
 */
mvc.LocalSync.prototype.update = function(model, opt_callback) {
  this.store_.set(/** @type {string} */(model.get('id')), model.toJson());
  if (goog.isFunction(opt_callback)) {
    opt_callback.call(model, model);
  }
};


/**
 * @inheritDoc
 */
mvc.LocalSync.prototype.del = function(model, opt_callback) {
  this.store_.remove(/** @type {string} */(model.get('id')));
  if (goog.isFunction(opt_callback)) {
    opt_callback.call(model, model);
  }
};
