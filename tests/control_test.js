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

var testSimpleControl = function() {
  assertEquals('should come back with one element', 1,
      simpleControl.getEls('.class2').length);
  assertEquals('should come back with 2 elements', 2,
      simpleControl.getEls('.class1').length);
};

var testControlListener = function() {
  var toggle = false;
  var handle = function() {toggle = !toggle;};
  var uid = simpleControl.click(handle);
  var evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleControl.getElement().dispatchEvent(evt);
  assert('true, click should be handled', toggle);
  simpleControl.off(uid);
  evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleControl.getElement().dispatchEvent(evt);
  assert('true, click listener should be removed', toggle);
};

var testControlOnce = function() {
  var toggle = false;
  var handle = function() {
    toggle = !toggle;
  };
  simpleControl.once(goog.events.EventType.CLICK, handle);
  var evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleControl.getElement().dispatchEvent(evt);
  assert('true, click should be handled', toggle);
  evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleControl.getElement().dispatchEvent(evt);
  assert('true, click listener should be removed', toggle);
};

var testPriority = function() {
  var count = 1;
  var a;
  var b;
  var c;
  var d;

  var incA = function() {a = count++};
  var incB = function() {b = count++};
  var incC = function() {c = count++};
  var incD = function() {d = count++};

  simpleControl.click(incB, undefined, undefined);
  simpleControl.click(incA, undefined, undefined, 30);
  simpleControl.click(incD, undefined, undefined, 70);
  simpleControl.click(incC, undefined, undefined);

  var evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleControl.getElement().dispatchEvent(evt);

  assertEquals(1, a);
  assertEquals(2, b);
  assertEquals(3, c);
  assertEquals(4, d);
};

var testListenerFire = function() {
  var el;
  var fn = function(e) {
    el = e.target;
  };
  simpleControl.on('click', fn).fire();
  assertEquals(el, simpleControl.getElement());
};

var testListenerFireTarget = function() {
  var el;
  var target = document.createElement('DIV');
  var fn = function(e) {
    el = e.target;
  };
  simpleControl.on('click', fn).fire(target);
  assertEquals(el, target);
};

var testListenerOff = function() {
  var run = false;
  var fn = function(e) {
    run = true;
  };
  var bound = simpleControl.on('click', fn);
  var evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleControl.getElement().dispatchEvent(evt);
  assert('true, click should be handled', run);
  bound.off();
  evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleControl.getElement().dispatchEvent(evt);
  assert('true, click listener should be removed', run);
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

