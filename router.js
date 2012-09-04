//     (c) 2012 Rhys Brett-Bowen, Catch.com
//     goog.mvc may be freely distributed under the MIT license.
//     For all details and documentation:
//     https://github.com/rhysbrettbowen/goog.mvc

goog.provide('mvc.Router');

goog.require('goog.History');
goog.require('goog.array');
goog.require('goog.events');
goog.require('goog.history.Html5History');



/**
 * @constructor
 *
 * @param {boolean=} opt_noFragment set to true to hide fragment when using
 * HTML5 history.
 * @param {string=} opt_blankPage url to a blank page - needed if HTML5 is not
 * available and you don't want to show the fragment.
 * @param {HTMLInputElement=} opt_input The hidden input element to be used to
 * store the history token.  If not provided, a hidden input element will
 * be created using document.write.
 * @param {HTMLIFrameElement=} opt_iframe The hidden iframe that will be used by
 * IE for pushing history state changes, or by all browsers if opt_noFragment
 * is true. If not provided, a hidden iframe element will be created using
 * document.write.
 */
mvc.Router = function(opt_noFragment, opt_blankPage, opt_input, opt_iframe) {
  this.history_ = goog.history.Html5History.isSupported() ?
      new goog.history.Html5History() :
      new goog.History(!!(opt_blankPage && opt_noFragment), opt_blankPage,
        opt_input, opt_iframe);
  if (this.history_.setUseFragment)
    this.history_.setUseFragment(!opt_noFragment);
  goog.events.listen(this.history_, goog.history.EventType.NAVIGATE,
      this.onChange_, false, this);
  this.history_.setEnabled(true);
  this.routes_ = [];
};


/**
 * pass through the fragment for the URL
 *
 * @param {string} fragment to set for the history token.
 */
mvc.Router.prototype.navigate = function(fragment) {
  this.history_.setToken(fragment);
};


/**
 * define route as string or regex. /:abc/ will pass "abc" through as an
 * argument. *abc/def will pass through all after the * as an argument
 *
 * @param {string|RegExp} route to watch for.
 * @param {function(string, ...[string])} fn should take in the token and any captured strings.
 * @param {Object=} opt_context Object in whose context the function is to be
 *     called (the global scope if none).
 */
mvc.Router.prototype.route = function(route, fn, opt_context) {
  if (goog.isString(route))
    route = new RegExp('^' + goog.string.regExpEscape(route)
            .replace(/\\:\w+/g, '(\\w+)')
            .replace(/\\\*/g, '(.*)')
            .replace(/\\\[/g, '(')
            .replace(/\\\]/g, ')?')
            .replace(/\\\{/g, '(?:')
            .replace(/\\\}/g, ')?') + '$');
  this.routes_.push({route: route, callback: fn, context: opt_context});
};


/**
 * @private
 */
mvc.Router.prototype.onChange_ = function() {
  var fragment = this.history_.getToken();
  goog.array.forEach(this.routes_ || [], function(route) {
    var args = route.route.exec(fragment);
    if (!args)
      return;
    route.callback.apply(route.context, args);
  }, this);
};
