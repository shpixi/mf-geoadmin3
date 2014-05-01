(function() {
  goog.provide('ga_qrcode_service');

  var module = angular.module('ga_qrcode_service', []);

  module.provider('gaQRCode', function() {

    this.$get = function() {
      var qrcode;

      var create = function(el, options) {
        if (!qrcode) {
          qrcode = new window.QRCode(el, {
            text: options.url,
            width: options.width,
            height: options.height
          });
        } else {
          update(options.url);
        }
      };

      function clear() {
        if (qrcode) {
          qrcode.clear();
          qrcode = null;
        }
      }

      function update(url) {
        qrcode.makeCode(url);
      }

      return {
        create: create,
        clear: clear,
        update: update,
        get: function() {
          return qrcode;
        }
      };
    };
  });
})();
