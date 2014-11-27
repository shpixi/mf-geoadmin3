(function() {
  goog.provide('ga_query_directive');

  goog.require('ga_map_service');
  goog.require('ga_query_service');


  var module = angular.module('ga_query_directive', [
    'ga_map_service', 'ga_query_service'

  ]);

  module.controller('GaQueryDirectiveController', function($scope, gaQuery,
      $http) {
    $scope.queryType = 0;
    $scope.searchableLayers = [];
    $scope.queries = [{
      layer: null,
      attribute: null,
      operator: null,
      value: null
    }];
    var hasRegistered = false, oldValue;
    $scope.$watch(function() {
      if (hasRegistered) return;
      hasRegistered = true;
      $scope.$$postDigest(function() {
        window.console.debug('digest');
        hasRegistered = false;
      });
    });

    // Display the first attribute as selected
    var noAttr = {label: 'query_no_attr'};
    var applyAttrValues = function(query) {
      query.attribute = query.layer.attributes[0] || noAttr;
      $scope.applyOpValues(query);
    };

    // Display the first operator as selected
    $scope.applyOpValues = function(query) {
      if (query.attribute.operators) {
        query.operator = query.attribute.operators[0];
      }
    };

    // Load attributes of the selected layer in the select box
    $scope.loadAttributes = function(query) {
      gaQuery.getLayerAttributes($scope, query.layer.bodId)
        .then(function(attributes) {
          query.layer.attributes = attributes;
          applyAttrValues(query);
        });
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

    // Get parameters for an ESRI query request.
    var getParamsByLayer = function(queries, extent) {
      // In this case queries contains all the query on one layer */
      var list = [];
      var paramsByLayer = {};

      angular.forEach(queries, function(query, idx) {
        if (!query.layer || !query.value) {
          return;
        }
        if (!paramsByLayer[query.layer.bodId]) {
          paramsByLayer[query.layer.bodId] = {
            bodId: query.layer.bodId,
            params: {}
          };
          list.push(paramsByLayer[query.layer.bodId]);
        }
        var params = paramsByLayer[query.layer.bodId].params;

        // Bbox condition
        if (extent && !params.geometry) {
          params.geometry = extent;
        }

        // Where condition
        var where = (params.where) ? params.where + ' and ' : '';
        where += query.attribute.label + ' ' + query.operator + ' ' +
            query.attribute.transformToLiteral(query.value);
        params.where = where;
      });
      return list;
    };

    // Launch a search only with a bbox
    $scope.searchByBbox = function() {
      if (!$scope.extent || $scope.searchableLayers.length == 0) {
        $scope.options.results = [];
        return;
      }
      gaQuery.getLayersFeaturesByBbox($scope, $scope.searchableLayers, $scope.extent)
        .then(function(layerFeatures) {
          $scope.options.results = layerFeatures;
        });
    };

    // Launch a complex search
    $scope.searchByAttributes = function() {
      var features = [];
      var params = getParamsByLayer($scope.queries, $scope.extent);
      if (params.length == 0) {
        $scope.options.results = [];
        return;
      }
      angular.forEach(
        params,
        function(paramsByLayer) {
          gaQuery.getLayerFeatures(
            $scope,
            paramsByLayer.bodId,
            paramsByLayer.params
          ).then(function(layerFeatures) {
            $scope.options.results = features.concat(layerFeatures);
          });
        }
      );
    }; 
    
    // Launch a search according to the active tab 
    $scope.search = function() {
      if ($scope.queryType == 0) {
        $scope.searchByBbox();
      } else {
        $scope.searchByAttributes();
      }
    };
  });

  module.directive('gaQuery', function($http, gaBrowserSniffer, gaLayerFilters, gaStyleFactory) {
    var parser = new ol.format.GeoJSON();
    var dragBox, boxOverlay;
    var dragBoxStyle = gaStyleFactory.getStyle('selectrectangle');
    var boxFeature = new ol.Feature();
   

    return {
      restrict: 'A',
      templateUrl: 'components/query/partials/query.html',
      controller: 'GaQueryDirectiveController',
      scope: {
        map: '=gaQueryMap',
        options: '=gaQueryOptions',
        isActive: '=gaQueryActive'
      },
      link: function(scope, element, attrs, controller) {
             
        // Init the map stuff 
        if (!boxOverlay) {
          boxOverlay = new ol.FeatureOverlay({
            map: scope.map,
            style: dragBoxStyle
          });
          boxOverlay.addFeature(boxFeature);
        }
        if (!dragBox) {
          dragBox = new ol.interaction.DragBox({
            condition: function(evt) {
              //MacEnvironments don't get here because the event is not
              //recognized as mouseEvent on Mac by the google closure.
              //We have to use the apple key on those devices
              return evt.originalEvent.ctrlKey ||
                  (gaBrowserSniffer.mac && evt.originalEvent.metaKey);
            },
            style: dragBoxStyle
          });
          scope.map.addInteraction(dragBox);
          dragBox.on('boxstart', function(evt) {
            boxFeature.setGeometry(null);  
          });
          dragBox.on('boxend', function(evt) {
            scope.isActive = true;
            scope.queryType = 0;
            scope.extent = evt.target.getGeometry().getExtent();
            boxFeature.setGeometry(evt.target.getGeometry());  
            scope.searchByBbox();
          });
        }
      
        // Activate/Deactivate 
        var showBox = function() {
          boxOverlay.setMap(scope.map);
        };
        var hideBox = function() {
          boxOverlay.setMap(null);
        };

        var activate = function() {
          if (scope.queryType == 0) {
            showBox();
          }
        };

        var deactivate = function() {
          hideBox();
        };
     
        // Watcher/listener
        scope.layers = scope.map.getLayers().getArray();
        scope.layerFilter = gaLayerFilters.selectByRectangle;
        scope.$watchCollection('layers | filter:layerFilter', function(layers) {
          scope.searchableLayers = layers;
          scope.search();
        });
   
        scope.$watch('isActive', function(newVal, oldVal) {
          if (newVal != oldVal) {
            if (newVal) {
              activate();
            } else {
              deactivate();
            }
          }
        });

        var currentYear;
        scope.$on('gaTimeSelectorChange', function(event, newYear) {
          if (newYear !== currentYear) {
            currentYear = newYear;
            if (queryType == 0) {
              scope.search();
            }
          }
        });

      }
    };
  });
})();

