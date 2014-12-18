(function() {
  goog.provide('ga_timestamp_control_directive');

  var module = angular.module('ga_timestamp_control_directive', []);

  module.directive('gaTimestampControl', function() {
    return {
      restrict: 'A',
      scope: {
        map: '=gaTimestampControlMap'
      },
      templateUrl: 'components/timestampcontrol/partials/timestampcontrol.html',
      link: function(scope, element) {
        scope.layers = scope.map.getLayers().getArray();
        scope.$watchCollection('layers',
            function(layers) {
          var timestamps = [];
          angular.forEach(layers, function(layer) {
            // Alterantively get the timestamp from the source
            // vectorSource.on('change', function(event) { ...
            // vectorSource.getState()
            var timestamp = layer.get('timestamp');
            if (layer instanceof ol.layer.Vector && timestamp) {
              timestamps.push(timestamp);
            }
            element.find('.ga-timestamp-control').html(timestamps.join(', '));
          });
        });
      }
    };
  });

})();
