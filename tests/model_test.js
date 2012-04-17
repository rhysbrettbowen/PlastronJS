goog.require('mvc.Model');

goog.require('goog.testing.jsunit');

var simpleModel;
var emptyModel;

var setUp = function() {
  simpleModel = new mvc.Model({attr:
    {'a':'exists'}});
  emptyModel = new mvc.Model();
};

var testSimpleModel = function() {
  assertNotNullNorUndefined("New model created", simpleModel);
  assertEquals("Should be able to get 'a'", simpleModel.get('a'), 'exists');
  assertUndefined("Should return undefined", simpleModel.get('b'));
  simpleModel.set('a', 'changed');
  assertEquals("Should be able to change 'a'", simpleModel.get('a'), 'changed');
  simpleModel.set('b', 'new');
  assertEquals("Should be able to add new attribute 'b'", simpleModel.get('b'), 'new');
  simpleModel.unset('b');
  assertUndefined("Should be able to remove attribute 'b'", simpleModel.get('b'));
};

var testEmptyModel = function() {
  assertNotNull(emptyModel);
};

var testAlias = function() {
  simpleModel.set('date', {day:1,month:1});
  simpleModel.alias('1jan2010', 'date');
  assertEquals(simpleModel.get('1jan2010'), simpleModel.get('date'));
};

var testFormat = function() {
  simpleModel.set('date', {day:1,month:1});
  simpleModel.format('date', function(date) {
      return date.day+"/"+date.month;
  });
  assertEquals(simpleModel.get('date'), "1/1");
};

var testMeta = function() {
  simpleModel.set('day',1);
  simpleModel.set('month',1);
  simpleModel.meta('jan1', ['day', 'month'], function(day, month) {
    return day+"/"+month;
  });
  assertEquals(simpleModel.get('jan1'),"1/1");
};

var testValidateString = function() {
  var error = false;
  simpleModel.errorHandler(function() {
    error = true;
  });
  simpleModel.setSchema({'a':
    {
      set: 'string'
    }});
  simpleModel.set('a', 'a string');
  assert(!error);
  simpleModel.set('a', {});
  assert(error);
};

var testValidateRegex = function() {
  var error = false;
  simpleModel.errorHandler(function() {
    error = true;
  });
  simpleModel.setSchema({'a':
    {
      set: /abc/
    }});
  simpleModel.set('a', 'abcdefg');
  assert(!error);
  simpleModel.set('a', 'hijklmn');
  assert(error);
};

var testValidateType = function() {
  var error = false;
  simpleModel.errorHandler(function() {
    error = true;
  });
  var M = function(){
    goog.base(this);
  };
  goog.inherits(M, mvc.Model);
  var m = new M();
  simpleModel.setSchema({'a':
    {
      set: mvc.Model
    }});
  simpleModel.set('a', m, true);
  assert(!error);
  simpleModel.set('a', 'hijklm');
  assert(error);
};


