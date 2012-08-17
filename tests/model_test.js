goog.require('goog.testing.jsunit');
goog.require('mvc.Model');
goog.require('mvc.Model.ValidateError');



var simpleModel;
var emptyModel;

var setUp = function() {
  simpleModel = new mvc.Model({
    attr: {
      'a': 'exists'
    }
  });
  emptyModel = new mvc.Model();
};

var testSimpleModel = function() {
  assertNotNullNorUndefined('New model created', simpleModel);
  assertEquals('Should be able to get a', simpleModel.get('a'), 'exists');
  assertUndefined('Should return undefined', simpleModel.get('b'));
  simpleModel.set('a', 'changed');
  assertEquals('Should be able to change a', simpleModel.get('a'), 'changed');
  simpleModel.set('b', 'new');
  assertEquals('Should be able to add new attribute b',
      simpleModel.get('b'), 'new');
  simpleModel.unset('b');
  assertUndefined('Should be able to remove attribute b', simpleModel.get('b'));
};

var testModelOptions = function() {
  // test reserved keyword
  var a = new mvc.Model({'schema': {}});
  assertUndefined(a.get('schema'));
  //test keyword  under 'attr'
  a = new mvc.Model({'attr': {
    'schema': {}
  }});
  assertNotUndefined(a.get('schema'));
};

var testCid = function() {
  // test cid generated
  var a = new mvc.Model();
  assertNotNullNorUndefined(a.getCid());

  // test two models have different cid
  var b = new mvc.Model();
  assertNotEquals(a.getCid(), b.getCid());
};

var testEmptyModel = function() {
  assertNotNull(emptyModel);
};

var testAlias = function() {
  simpleModel.set('date', {day: 1, month: 1});
  simpleModel.alias('1jan2010', 'date');
  assertEquals(simpleModel.get('1jan2010'), simpleModel.get('date'));
};

var testFormat = function() {
  simpleModel.set('date', {day: 1, month: 1});
  simpleModel.format('date', function(date) {
    return date.day + '/' + date.month;
  });
  assertEquals(simpleModel.get('date'), '1/1');
};

var testMeta = function() {
  simpleModel.set('day', 1);
  simpleModel.set('month', 1);
  simpleModel.meta('jan1', ['day', 'month'], function(day, month) {
    return day + '/' + month;
  });
  assertEquals(simpleModel.get('jan1'), '1/1');
};

var testSetter = function() {
  simpleModel.setter('a', function(a) {return 1;});
  simpleModel.set('a', 2);
  assertEquals('should get back 1', simpleModel.attr_['a'], 1);
};

var testValidate = function() {
  var b = false;
  simpleModel.set('a', 1);
  var handleErr = function() {
    b = true;
  }
  simpleModel.errorHandler(handleErr);
  simpleModel.setter('a', function(a) {
    if (a % 2 === 0)
      throw new mvc.Model.ValidateError('must be odd number');
    return a;
  });
  simpleModel.set('a', 2);
  assertEquals('should get back 1', simpleModel.attr_['a'], 1);
  assert('error should be handled', b);
  simpleModel.set('a', 3);
  assertEquals('should get back 3', simpleModel.attr_['a'], 3);
};

var testValidateString = function() {
  var error = false;
  simpleModel.errorHandler(function() {
    error = true;
  });
  simpleModel.setSchema({
    'a': {
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
  simpleModel.setSchema({
    'a': {
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
  var M = function() {
    goog.base(this);
  };
  goog.inherits(M, mvc.Model);
  var m = new M();
  simpleModel.setSchema({'a': {
    set: mvc.Model
  }});
  simpleModel.set('a', m, true);
  assert(!error);
  simpleModel.set('a', 'hijklm');
  assert(error);
};

var testSchemaFunctionParsing = function() {
  var A = function() {};
  A.prototype.a = 1;
  var B = function() {};
  B.prototype.a = 1;
  goog.inherits(B, A);
  var C = function() {};
  C.prototype.a = 1;
  var parse = mvc.Model.prototype.parseSchemaFn_;
  var parseFn = parse(function(a) {
    if (a % 2 != 0) throw new mvc.model.ValidateError('odd');
    return a;
  });
  var parseNum = parse('Number');
  var parseReg = parse(/abc/);
  var parseType = parse(A);

  // test parsing a string
  assertEquals(123, parseNum(123));
  assertThrows(goog.bind(parseNum, this, 'a string'));

  // test parsing a function
  assertEquals(6, parseFn(6));
  assertThrows(goog.bind(parseFn, this, 5));

  // test a regex
  assertEquals('abcde', parseReg('abcde'));
  assertThrows(goog.bind(parseReg, this, 'abd'));

  //test type
  var b = new B();
  var c = new C();
  assertEquals(b, parseType(b));
  assertThrows(goog.bind(parseType, this, c));
};

var testCreate = function() {
  var a = mvc.Model.create({'a': 1});
  assertEquals(1, a.get('a'));
};

var testToJson = function() {
  var a = mvc.Model.create({'a': 1});
  assertEquals(1, a.toJson()['a']);
};

var testToJsObject = function() {
  var a = mvc.Model.create({
    'foo': 'bar',
    'price': 99,
    'date': new Date(1999, 11, 31),
    'schema': {
      'price': {
        get: function(price) {return price + 10},
        require: ['price']
      }
    }
  });
  a.format('date', function(date) {
    return (date.getMonth() + 1) + '/' + date.getDate();
  });
  a.meta('priceFriendly', ['price'], function(price) {
    return '$' + price;
  })
  var obj = a.toJsObject();
  assertEquals('bar', obj['foo']);
  assertEquals(109, obj['price']);
  assertEquals('$109', obj['priceFriendly']);
  assertEquals('12/31', obj['date']);
  assertNotThrows(emptyModel.toJsObject);
};

var testReset = function() {
  var a = mvc.Model.create({'a': 1});
  a.reset(true);
  assertUndefined(a.get('a'));
  assertEquals(1, a.prev('a'));
};

var testPrev = function() {
  var a = mvc.Model.create({'a': 1});
  assertEquals(1, a.prev('a'));
  a.set('a', 2, true);
  assertEquals(1, a.prev('a'));
};

var testIsNew = function() {
  var a = mvc.Model.create({'a': 1});
  assert(a.isNew());
  a.set('id', 'abc');
  assertFalse(a.isNew());
};

var testSetSchema = function() {
  var schemaA = {
    'a': {
      get: function(a) {return a * 2},
      require: ['a']
    }
  };
  var schemaB = {
    'b': {
      get: function(a) {return a * 2},
      require: ['b']
    }
  };
  var a = mvc.Model.create({
    'a': 1,
    'b': 1,
    'schema': schemaA
  });

  assertEquals(2, a.get('a'));
  assertEquals(schemaA, a.schema_);

  a.setSchema(schemaB);
  assertEquals(2, a.get('b'));
  assertEquals(1, a.get('a'));
  assertEquals(schemaB, a.schema_);
};

var testAddSchemaRules = function() {
  var schemaA = {
    'a': {
      get: function(a) {return a * 2},
      require: ['a']
    }
  };
  var schemaB = {
    'b': {
      get: function(a) {return a * 2},
      require: ['b']
    }
  };
  var a = mvc.Model.create({
    'a': 1,
    'b': 1,
    'schema': schemaA
  });

  assertEquals(2, a.get('a'));
  assertEquals(1, a.get('b'));
  assertEquals(schemaA, a.schema_);

  a.addSchemaRules(schemaB);
  assertEquals(2, a.get('b'));
  assertEquals(2, a.get('a'));
  assertNotEquals(schemaB, a.schema_);
  assertNotEquals(schemaA, a.schema_);
};

var testHas = function() {
  var schema = {
    'b': {
      get: function(b) {return b && b * 2;},
      require: ['b']
    },
    'c': {
      get: function(a) {return a && a * 2;},
      require: ['a']
    }
  };
  var a = mvc.Model.create({
    'schema': schema,
    'a': 1
  });

  assert(a.has('a'));
  assertFalse(a.has('b'));
  assert(a.has('c'));
};

var testUnset = function() {
  var a = mvc.Model.create({'a': 1});
  assertEquals(1, a.get('a'));
  a.unset('a');
  assertUndefined(a.get('a'));
  assertFalse(a.has('a'));
};

var testChanges = function() {
  var schema = {
    'b': {
      get: function(b) {return b && b * 2;},
      require: ['b']
    },
    'c': {
      get: function(a) {return a && a * 2;},
      require: ['a']
    }
  };
  var a = mvc.Model.create({
    'schema': schema,
    'a': 1,
    'b': 1
  });
  a.set('a', 1, true);
  assert(goog.array.equals(a.getChanges(), []));
  a.set('a', 2, true);
  assert(goog.array.equals(a.getChanges().sort(), ['a', 'c']));
};

var testRevert = function() {
  var a = mvc.Model.create({'a': 1});
  a.set('a', 2, true);
  a.revert(true);
  assertEquals(1, a.prev('a'));
  assertEquals(1, a.get('a'));
};

var testBinder = function() {
  var model = mvc.Model.create({'a': 1});
  var a = model.getBinder('a');
  assertEquals(1, a());
  a(2);
  assertEquals(2, a());
  assertEquals(2, model.get('a'));
};

var testBind = function() {
  var a = mvc.Model.create({'a': 1});
  var ran = false;
  var that;
  var bindFn = function() {
    ran = !ran;
    that = this;
  };
  a.bind('a', bindFn, this);
  a.set('a', 2);
  // test it ran
  assert(ran);
  //test that handler works
  assertEquals(this, that);
  a.set('b', 1);
  // test it doesn't change on other set
  assert(ran);
};

var testBindSchema = function() {
  var a = mvc.Model.create({'a': 1});
  var ran = false;
  var that;
  var bindFn = function() {
    ran = !ran;
    that = this;
  };
  a.bind('c', bindFn, this);
  // assert schema meta works
  a.meta('c', ['a'], function(a) {return a;});
  a.set('a', 2);
  assert(ran);
  assertEquals(this, that);
};

var testUnbind = function() {
  //test bound first
  var a = mvc.Model.create({'a': 1});
  var ran = false;
  var that;
  var bindFn = function() {
    ran = !ran;
    that = this;
  };
  var cancel = a.bind('a', bindFn, this);
  a.set('a', 2);
  // test it ran
  assert(ran);
  //test that handler works
  assertEquals(this, that);

  assert('should return that it was removed', a.unbind(cancel));
  a.set('a', 3);
  assert(ran);
};

var testBindAll = function() {
  var a = mvc.Model.create({'a': 1});
  var ran = false;
  var that;
  var bindFn = function() {
    ran = !ran;
    that = this;
  };
  a.bindAll(bindFn, this);
  a.set('a', 2);
  // test it ran
  assert(ran);
  //test that handler works
  assertEquals(this, that);
};

var testUnbindAll = function() {
  //test bound first
  var a = mvc.Model.create({'a': 1});
  var ran = false;
  var that;
  var bindFn = function() {
    ran = !ran;
    that = this;
  };
  var cancel = a.bindAll(bindFn, this);
  a.set('a', 2);
  // test it ran
  assert(ran);
  //test that handler works
  assertEquals(this, that);

  assert('should return that it was removed', a.unbind(cancel));
  a.set('a', 3);
  assert(ran);
};

var testBindUnload = function() {
  //test bound first
  var a = mvc.Model.create({'a': 1});
  var ran = false;
  var that;
  var bindFn = function() {
    ran = !ran;
    that = this;
  };
  var cancel = a.bindUnload(bindFn, this);
  a.dispose();
  // test it ran
  assert(ran);
  //test that handler works
  assertEquals(this, that);
};

var testUnbindUnload = function() {
  //test bound first
  var a = mvc.Model.create({'a': 1});
  var ran = false;
  var that;
  var bindFn = function() {
    ran = !ran;
    that = this;
  };
  var cancel = a.bindUnload(bindFn, this);
  a.unbind(cancel);
  a.dispose();
  // test it ran
  assertFalse(ran);

};

