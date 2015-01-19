(function() {
  goog.provide('ga_throttle_service');

  var module = angular.module('ga_throttle_service', []);

  /**
   *
   * Heavily inspired from mrgamer's angular-throttle.js
   * https://gist.github.com/mrgamer
   *
   */

  //no deferring at the moment

  module.provider('gaThrottle', function() {
    this.$get = function($timeout) {
      var Throttle = function() {
        this.throttle = function(callback, delay, no_trailing, debounce_mode) {

          var timeout_id,
          last_exec = 0;

          if (typeof no_trailing !== 'boolean') {
            debounce_mode = callback;
            callback = no_trailing;
            no_trailing = undefined;
          }

          return function() {
            var that = this,
                elapsed = +new Date() - last_exec,
                args = arguments;
            var exec = function() {
                  last_exec = +new Date();
                  callback.apply(that, args);
                };
            var clear = function() {
                  timeout_id = undefined;
                };

              if (debounce_mode && !timeout_id) { exec(); }
              if (timeout_id) { $timeout.cancel(timeout_id); }
              if (debounce_mode === undefined && elapsed > delay) {
                exec();
              } else if (no_trailing !== true) {
                timeout_id = $timeout(debounce_mode ? clear : exec,
                    debounce_mode === undefined ? delay - elapsed : delay);
              }
          };
        };
      };
      return new Throttle();
    };
  });
})();
