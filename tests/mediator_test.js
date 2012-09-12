goog.require('goog.testing.jsunit');

goog.require('mvc.Mediator');


var med;
var listen;

var setUp = function() {
  med = new mvc.Mediator();
};

testRegister = function() {
  var a = {};
  med.register(a, ['test']);
  assertEquals(a, med.available_['test'][0]);
};

testUnregister = function() {
  var a = {};
  med.unregister(a, ['test']);
  assertUndefined(med.available_['test']);
};

testListen = function() {
  listen = med.on('test', function() {});
  assert(med.isListened('test'));
};

testUnlisten = function() {
  med.off(listen);
  assert(!med.isListened('test'));
};

testInit = function() {
  var a = false;
  var b = {};
  med.on('testInit', {
    fn: goog.nullFunction,
    init: function() {a = true;}
  });
  med.register(b, ['testInit']);
  assert('function should fire on init', a);
};

testInitWild = function() {
  var a = 0;
  var b = {};
  var fn = function(){a++;};
  med.on('testInit.blah.%', {
    fn: goog.nullFunction,
    init: fn
  });
  med.register(b, ['testInit.blah.fred.fire']);
  assertEquals('function should fire on init', 1, a);
};

testListenWild = function() {
  var a = 0;
  var b = {};
  var fn = function(){a++;};
  med.on('abc*.efg.%.klmn', fn);
  med.broadcast('abcpef.sdfsd.efg.uyt.klmn.pop');
  assertEquals('function should not fire', 0, a);
  med.broadcast('abcpef.sdfsd.efg.uy.t.klmn');
  assertEquals('function should not fire', 0, a);
  med.broadcast('abcpef.sdfsd.efg.uyt.klmn');
  assertEquals('function should fire', 1, a);
};

testListenWildChange = function() {
  med = new mvc.Mediator({
    split: ':',
    wild: '.',
    wildlvl: '+'
  })
  var a = 0;
  var b = {};
  var fn = function(){a++;};
  med.on('abc.:efg:+:klmn', fn);
  med.broadcast('abcpef:sdfsd:efg:uyt:klmn:pop');
  assertEquals('function should not fire', 0, a);
  med.broadcast('abcpef:sdfsd:efg:uy:t:klmn');
  assertEquals('function should not fire', 0, a);
  med.broadcast('abcpef:sdfsd:efg:uyt:klmn');
  assertEquals('function should fire', 1, a);
};

testDispose = function() {
  var a = false;
  var b = {};
  med.on('testDispose', {
    fn: goog.nullFunction,
    dispose: function() {a = true;}
  });
  med.register(b, ['testDispose']);
  assert('a is still false', !a);
  med.unregister(b);
  assert('a is now true', a);
};

