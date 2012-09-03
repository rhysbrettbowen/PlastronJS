

goog.require('goog.testing.ContinuationTestCase');
goog.require('goog.testing.jsunit');
goog.require('mvc.Router');


var router;

var setUp = function() {
  router = new mvc.Router();
};

var testNavigation = function() {
  router.navigate('testing');
  loc = document.location.toString();
  assertEquals(loc.replace(/.*#/, ''), 'testing');
};

var testRoute = function() {
  var reached = false;
  var a = function() {reached = true;};

  waitForEvent(router.history_, goog.history.EventType.NAVIGATE,
      function() {
        assert(reached);
      });
  router.route('test', a);
  router.navigate('test');
};

var testRouteCapturingGroup = function() {
    router.route('/note=:id[/edit][?*]', function (fragment, id, edit, query, queryVals) {
        assertEquals('/note=1234567890/edit?abc=123', fragment);
        assertEquals('1234567890', id);
        assertEquals('/edit', edit);
        assertEquals('?abc=123', query);
        assertEquals('abc=123', queryVals);
    });
    router.navigate('/note=1234567890/edit?abc=123');
};

var testRouteNonCapturingGroup = function() {
    router.route('/note=:id{/:operation}{?abc=:abc}', function (fragment, id, operation, abc) {
        assertEquals('/note=1234567890/edit?abc=123', fragment);
        assertEquals('1234567890', id);
        assertEquals('edit', operation);
        assertEquals('123', abc);
    });
    router.navigate('/note=1234567890/edit?abc=123');
};

var testRouteOptionalScope = function() {
    var reached = false;
    var context = {
        f: function () {
            reached = true;
        }
    };
    router.route('/test', function (fragment) {
        this.f();
    }, context);

    waitForEvent(router.history_, goog.history.EventType.NAVIGATE,
        function() {
            assertTrue(reached);
        });
    router.navigate('/test');
};

var testRouteGlobalScope = function() {
    var reached = false;
    goog.global.globalF = function () {
            reached = true;
    };
    router.route('/test', function (fragment) {
        this.globalF();
    });

    waitForEvent(router.history_, goog.history.EventType.NAVIGATE,
        function() {
            assertTrue(reached);
        });

    router.navigate('/test');
};

testCase = new goog.testing.ContinuationTestCase();
testCase.autoDiscoverTests();
G_testRunner.initialize(testCase);
