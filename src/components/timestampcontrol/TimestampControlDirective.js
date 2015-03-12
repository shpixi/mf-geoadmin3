(function() {
  goog.provide('ga_timestamp_control_directive');

  var module = angular.module('ga_timestamp_control_directive', []);

  module.directive('gaTimestampControl', function($rootScope) {
    return {
      restrict: 'A',
      scope: {
        map: '=gaTimestampControlMap'
      },
      templateUrl: 'components/timestampcontrol/partials/timestampcontrol.html',
      link: function(scope, element) {
        scope.layers = scope.map.getLayers().getArray();
        scope.$watchCollection('layers', function(layers) {
          var hasGeojsonLayers = false;
          angular.forEach(layers, function(layer) {
            if (layer.get('type') == 'geojson') {
              hasGeojsonLayers = true;
            }
          });
          if (!hasGeojsonLayers) {
            element.find('.ga-timestamp-control').html('');
          }
        });
        $rootScope.$on('gaNewLayerTimestamp', function(e, timestamp) {
          element.find('.ga-timestamp-control').html(timestamp);
        });
      }
    };
  });

})();
