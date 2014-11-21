(function() {
  goog.provide('ga_query_directive');

  goog.require('ga_map_service');
  
  var module = angular.module('ga_query_directive', [
    'ga_map_service'
  ]);

  module.controller('GaQueryDirectiveController', function($scope) {
    $scope.queryType = 0;
    $scope.searchableLayers = [];
    $scope.queries = [{
      layer: null,
      attribute: null,
      operator: null
    }];
    
    var noAttr = {label: 'query_no_attr'};
    var applyAttrValues = function(query) {
      query.attribute =  query.layer.attributes[0] || noAttr;
      if (query.attribute.operators) {
        query.operator = query.attribute.operators[0];
      }
    };
    
    // Load attributes of the selected layer in the select box 
    $scope.loadAttributes = function(query) {
      if (!query.layer.attributes) {
        $http.get($scope.options.layerAttributesUrl + query.layer.bodId)
          .success(function(data) {
            var attr = []
            for (var i = 0, ii = data.length; i < ii; i++) {
              attr.push({
                label: data[i],
                operators: $scope.options.operatorsByType['string']
              });
            } 
            query.layer.attributes = attr;
            applyAttrValues(query);
          }
        );
      } else {
        applyAttrValues(query);
      }
    };
    
    // Add a query
    $scope.add = function(idx) {
      var query = $scope.queries[idx];
      var clone = {
        layer: query.layer,
        attribute: query.attribute,
        operator: query.operator,
        value: query.value
      };
      $scope.queries.splice(idx, 0, clone);
    };
    
    // Remove a query
    $scope.remove = function(idx) {
      $scope.queries.splice(idx, 1);
    };

  });

  module.directive('gaQuery', function($http, gaLayerFilters) {
    
    return {
      restrict: 'A',
      templateUrl: 'components/query/partials/query.html',
      controller: 'GaQueryDirectiveController',
      scope: {
        map: '=gaQueryMap',
        options: '=gaQueryOptions'
      },
      link: function(scope, element, attrs, controller) {
        scope.layers = scope.map.getLayers().getArray();
        scope.layerFilter = gaLayerFilters.selectByRectangle;
        scope.$watchCollection('layers | filter:layerFilter', function(layers) {
          scope.searchableLayers = layers;
        });

        scope.searchByBbox = function() {
        };
        scope.searchByAttributes = function() {
        };
        scope.search = function() {
          var layersBodId = scope.queries[0].layer,
              req, searchExtent;
          if (layersBodIds) {
            req = getUrlAndParameters(layersToQuery, searchExtent);
          
            $http.get(req.url, {
              params: req.params
            }).success(function(res) {
              scope.$emit('gaUpdateFeatureTree', res);
            }).error(function(reason) {
              scope.$emit('gaUpdateFeatureTree', {});
            });
          }
        };
      }
    };
  });
})();

