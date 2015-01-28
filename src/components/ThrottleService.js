(function() {
  goog.provide('ga_throttle_service');

  var module = angular.module('ga_throttle_service', []);

  //no deferring at the moment

  module.provider('gaThrottle', function() {
    this.$get = function($timeout) {
      var Throttle = function() {
        this.throttle = function(callback, delay, noTrailing) {

          var timeoutId,
          lastExec = 0;

          return function() {
            var that = this,
                elapsed = +new Date() - lastExec,
                args = arguments;
            var exec = function() {
                  lastExec = +new Date();
                  callback.apply(that, args);
                };
            var clear = function() {
                  timeoutId = undefined;
                };

            if (timeoutId) {
              $timeout.cancel(timeoutId);
            }
            timeoutId = $timeout(exec, delay);
          };
        };
      };
      return new Throttle();
    };
  });
})();
