(function() {
  goog.provide('ga_contextpopup_controller');

  var module = angular.module('ga_contextpopup_controller', []);

  module.controller('GaContextPopupController',
      function($scope, gaGlobalOptions) {
        $scope.options = {
          heightUrl: gaGlobalOptions.apiUrl + '/rest/services/height',
          lv03tolv95Url: gaGlobalOptions.apiUrl + '/reframe/lv03tolv95',
          qrcodeWidth: 128,
          qrcodeHeight: 128
        };

      });

})();
