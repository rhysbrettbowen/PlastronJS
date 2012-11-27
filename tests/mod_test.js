goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.jsunit');
goog.require('mvc.Mod');
goog.require('mvc.Collection');
goog.require('mvc.Model');


var coll;
var model1, model2, model3, model4, model5, model6;

var setUp = function() {
  model1 = new mvc.Model({'a': 1});
  model2 = new mvc.Model({'a': 2});
  model3 = new mvc.Model({'a': 3});
  model4 = new mvc.Model({'a': 4});
  model5 = new mvc.Model({'a': 5});
  model6 = new mvc.Model({'a': 6});

  coll = new mvc.Collection();

  coll.add(model1);
  coll.add(model2);
  coll.add(model3);
  coll.add(model4);
  coll.add(model5);
  coll.add(model6);

};

var testFilter = function() {

  var fn = function(a) {return a.get('a')%2;};

  var test = function(arg) {
    console.log(arg, 'change found');
  };

  var Filter = function() {};
  Filter.prototype = coll;
  var filter = new Filter();

  goog.mixin(filter, mvc.Mod);
  goog.mixin(filter, mvc.Filter);

  filter.init(coll, fn);

  filter.modelChange(test);

  coll.modelChange(test);

  console.log('add Odd');

  filter.add(new mvc.Model({'a': 7}));

  console.log('add Even');

  filter.add(new mvc.Model({'a': 8}));
};

