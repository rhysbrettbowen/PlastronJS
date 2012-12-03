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

goog.provide('mvc.Sync');



/**
 * Sync object used to communicate between model and source
 *
 * @interface
 */
mvc.Sync = function() {};


/*
This can be used for HTTP status

mvc.Sync.Status = {
    // Successful
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    // Client Error
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    PAYMENT: 402,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    NOT_ACCEPTABLE: 406,
    REQUEST_TIMEOUT: 408,
    CONFLICT: 409,
    GONE: 410,
    // Server Error
    INTERNAL_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    GATEWAY_TIMEOUT: 504
}*/


/**
 * take in the model to push to server (use .toJson())
 * and call callback when done
 * pass in the json and status (use HTTP status codes) as a number.
 *
 * @param {mvc.Model} model to create.
 * @param {function(Object, number=)=} opt_callback optional.
 */
mvc.Sync.prototype.create = function(model, opt_callback) {};


/**
 * take in the model to push to server (use .toJson())
 * and call callback when done
 * pass in the json and status (use HTTP status codes) as a number.
 *
 * @param {mvc.Model} model to refresh.
 * @param {function(Object, number=)=} opt_callback optional.
 */
mvc.Sync.prototype.read = function(model, opt_callback) {};


/**
 * take in the model to push to server (use .toJson())
 * and call callback when done
 * pass in the json and status (use HTTP status codes) as a number.
 *
 * @param {mvc.Model} model to update.
 * @param {function(Object, number=)=} opt_callback optional.
 */
mvc.Sync.prototype.update = function(model, opt_callback) {};


/**
 * take in the model to push to server (use .toJson())
 * and call callback when done
 * pass in the status (use HTTP status codes) as a number.
 *
 * @param {mvc.Model} model to delete.
 * @param {Function=} opt_callback optional.
 */
mvc.Sync.prototype.del = function(model, opt_callback) {};
