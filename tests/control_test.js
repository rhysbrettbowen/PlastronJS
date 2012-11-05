goog.require('goog.dom');
goog.require('goog.testing.jsunit');
goog.require('mvc.Control');
goog.require('mvc.Model');



var simpleControl;

var setUp = function() {
  simpleModel = new mvc.Model();
  simpleControl = new mvc.Control(simpleModel);
  simpleControl.decorate(goog.dom.getElement('control'));
};

var testChangeModel = function() {
var mod;
var num;
var fn = function(a, model) {
  num = a;
  mod = model;
};
var model1 = new mvc.Model({'a': 1});

var model2 = new mvc.Model({'a': 2});

var control = new mvc.Control(model1);
control.bind('a', fn).fire();
assertEquals(1, num);
assertEquals(model1, mod);
control.setModel(model2);
assertEquals(2, num);
assertEquals(model2, mod);
model1.set('a', 3);
assertEquals(2, num);
assertEquals(model2, mod);
};

