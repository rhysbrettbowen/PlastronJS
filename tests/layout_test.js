goog.require('goog.dom');
goog.require('goog.testing.jsunit');
goog.require('mvc.Layout');



var simpleLayout;

var setUp = function() {
  simpleLayout = new mvc.Layout();
  simpleLayout.decorate(goog.dom.getElement('control'));
};

var testSimpleControl = function() {
  assertEquals('should come back with one element', 1,
      simpleLayout.getEls('.class2').length);
  assertEquals('should come back with 2 elements', 2,
      simpleLayout.getEls('.class1').length);
};

var testControlListener = function() {
  var toggle = false;
  var handle = function() {toggle = !toggle;};
  var uid = simpleLayout.click(handle);
  var evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleLayout.getElement().dispatchEvent(evt);
  assert('true, click should be handled', toggle);
  simpleLayout.off(uid);
  evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleLayout.getElement().dispatchEvent(evt);
  assert('true, click listener should be removed', toggle);
};

var testControlOnce = function() {
  var toggle = false;
  var handle = function() {
    toggle = !toggle;
  };
  simpleLayout.once(goog.events.EventType.CLICK, handle);
  var evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleLayout.getElement().dispatchEvent(evt);
  assert('true, click should be handled', toggle);
  evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleLayout.getElement().dispatchEvent(evt);
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

  simpleLayout.click(incB, undefined, undefined);
  simpleLayout.click(incA, undefined, undefined, 30);
  simpleLayout.click(incD, undefined, undefined, 70);
  simpleLayout.click(incC, undefined, undefined);

  var evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleLayout.getElement().dispatchEvent(evt);

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
  simpleLayout.on('click', fn).fire();
  assertEquals(el, simpleLayout.getElement());
};

var testListenerFireTarget = function() {
  var el;
  var target = document.createElement('DIV');
  var fn = function(e) {
    el = e.target;
  };
  simpleLayout.on('click', fn).fire(target);
  assertEquals(el, target);
};

var testListenerOff = function() {
  var run = false;
  var fn = function(e) {
    run = true;
  };
  var bound = simpleLayout.on('click', fn);
  var evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleLayout.getElement().dispatchEvent(evt);
  assert('true, click should be handled', run);
  bound.off();
  evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false,
      false, false, 0, null);
  simpleLayout.getElement().dispatchEvent(evt);
  assert('true, click listener should be removed', run);
};



