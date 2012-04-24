goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.jsunit');
goog.require('mvc.Collection');
goog.require('mvc.Model');


var model1, model2, model3;

var setUp = function() {
  model1 = new mvc.Model({'sort': 3});
  model2 = new mvc.Model({'sort': 1});
  model3 = new mvc.Model({'sort': 2});
};

var testUnsortedCollection = function() {
  var test = new mvc.Collection({'models': [model1, model2, model3]});
  assertEquals('first object should be mock 1', test.at(0), model1);
  assertEquals('second object should be mock 2', test.at(1), model2);
  assertEquals('third object should be mock 3', test.at(2), model3);
};

var testSortedCollection = function() {
  var sort = function(a, b) {return a.get('sort') - b.get('sort');};
  var test = new mvc.Collection();
  test.setComparator(sort);
  test.add(model1);
  assertEquals('first object should be mock 1', test.at(0), model1);
  test.add(model2);
  assertEquals('first object should be mock 2', test.at(0), model2);
  assertEquals('second object should be mock 1', test.at(1), model1);
  test.add(model3);
  assertEquals('first object should be mock 2', test.at(0), model2);
  assertEquals('second object should be mock 3', test.at(1), model3);
  assertEquals('third object should be mock 1', test.at(2), model1);
};

var testNewSortedCollection = function() {
  var sort = function(a, b) {return a.get('sort') - b.get('sort');};
  var test = new mvc.Collection({'models': [model1, model2, model3]});
  test.setComparator(sort);
  assertEquals('first object should be mock 2', test.at(0), model2);
  assertEquals('second object should be mock 3', test.at(1), model3);
  assertEquals('third object should be mock 1', test.at(2), model1);
};

var testAsModel = function() {
  var test = new mvc.Collection();
  test.set('a', 1);
  assertEquals('should have attribute a as 1', test.get('a'), 1);
};

var testPluck = function() {
  var coll = new mvc.Collection();
  coll.newModel({
    'a': 1,
    'b': 1,
    'c': 1
  });
  coll.newModel({
    'a': 2,
    'b': 2,
    'c': 2
  });
  coll.newModel({
    'a': 3,
    'b': 3,
    'c': 3
  });
  assertEquals('array should be [1,2,3]',
      coll.pluck('a').toString(),
      [1, 2, 3].toString());
  var b = coll.pluck(['a', 'b']);
  assert('array should hold object with a, and b',
      b[0]['a'] == 1 &&
      b[0]['b'] == 1 &&
      !b[0]['c'] &&
      b[1]['a'] == 2 &&
      b[1]['b'] == 2 &&
      !b[1]['c'] &&
      b[2]['a'] == 3 &&
      b[2]['b'] == 3 &&
      !b[2]['c']
  );
};

var testLengthUpdate = function() {
  var coll = new mvc.Collection();
  assertEquals(coll.getLength(), 0);
  var mod = coll.newModel({});
  assertEquals(coll.getLength(), 1);
  coll.add(new mvc.Model({}));
  assertEquals(coll.getLength(), 2);
  coll.remove(mod);
  assertEquals(coll.getLength(), 1);
};

var testGetById = function() {
  var coll = new mvc.Collection();
  var mod = coll.newModel({'id': '123'});
  assertEquals(coll.getById('123'), mod);
};

var testClear = function() {
  var coll = new mvc.Collection();
  assertEquals(coll.getLength(), 0);
  var mod = coll.newModel({});
  assertEquals(coll.getLength(), 1);
  coll.clear();
  assertEquals(coll.getLength(), 0);
};

