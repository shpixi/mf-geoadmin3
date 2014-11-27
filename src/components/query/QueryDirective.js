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
    
    // Get parameters for a featureidentify request
    var getParams = function(layers, extent) {
      var ids = [], timeenabled = [], timestamps = [];
      layers.forEach(function(l) {
        var ts = '';
        if (l.time && l.time.substr(0, 4) != '9999') {
          ts = l.time.substr(0, 4);
        }
        ids.push(l.bodId);
        timeenabled.push(l.timeEnabled);
        timestamps.push(ts);
      });
      return {
        bbox: extent.toString();
        features: ids.join(','),
        timeEnabled: timeenabled.join(','),
        timeStamps: timestamps.join(',')
      };
    };

    // Launch a search only with a bbox
    $scope.searchByBbox = function() {
      gaQuery.getLayerFeaturesByBbox(
        $scope,
        getParams($scope.searchableLayers, $scope.extent)
      ).then(function(layerFeatures) {
        $scope.options.results = layerFeatures;
      });
    };

    // Launch a complex search
    $scope.searchByAttributes = function() {
      var features = [];
      angular.forEach(
        getParamsByLayer($scope.queries, $scope.extent),
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
  });

  module.directive('gaQuery', function($http, gaLayerFilters, gaStyleFactory) {
    var parser = new ol.format.GeoJSON();
    var dragBox =
    return {
      restrict: 'A',
      templateUrl: 'components/query/partials/query.html',
      controller: 'GaQueryDirectiveController',
      scope: {
        map: '=gaQueryMap',
        options: '=gaQueryOptions'
      },
      link: function(scope, element, attrs, controller) {

        // Watch the searchbale layers list
        scope.layers = scope.map.getLayers().getArray();
        scope.layerFilter = gaLayerFilters.selectByRectangle;
        scope.$watchCollection('layers | filter:layerFilter', function(layers) {
          scope.searchableLayers = layers;
          triggerChange();
        });

        // Update the tree based on map changes. We use a timeout in
        // order to not trigger angular digest cycles and too many
        // updates. We don't use the permalink here because we want
        // to separate these concerns.
        var triggerChange = function() {
          /*if (scope.isActive) {
            scope.tree = {};
            cancel();
            timeoutPromise = $timeout(function() {
              requestFeatures();
              timeoutPromise = null;
            }, 0);
          }*/
        };
        if (!dragBox) {
          dragBox = new ol.interaction.DragBox({
            condition: function(evt) {
              //MacEnvironments don't get here because the event is not
              //recognized as mouseEvent on Mac by the google closure.
              //We have to use the apple key on those devices
              return evt.originalEvent.ctrlKey ||
                  (gaBrowserSniffer.mac && evt.originalEvent.metaKey);
            },
            style: gaStyleFactory.getStyle('selectrectangle');
          });
          scope.map.addInteraction(dragBox);
        }
        dragBox.on('boxend', function(evt) {
          scope.extent = evt.target.getGeometry();
        });
        
        var currentYear;
        scope.$on('gaTimeSelectorChange', function(event, newYear) {
          if (newYear !== currentYear) {
            currentYear = newYear;
            triggerChange();
          }
        });


            var cancel = function() {
              if (timeoutPromise !== null) {
                $timeout.cancel(timeoutPromise);
              }
              if (canceler !== null) {
                canceler.resolve();
              }
              scope.loading = false;
              canceler = $q.defer();
            };

            var requestFeatures = function() {
              var layersToQuery = getLayersToQuery(),
                  req, searchExtent;
              if (layersToQuery.ids.length &&
                  scope.dragBox.getGeometry()) {
                searchExtent = ol.extent.boundingExtent(
                    scope.dragBox.getGeometry().getCoordinates()[0]);
                req = getUrlAndParameters(layersToQuery, searchExtent);

                scope.loading = true;

                // Look for all features in current bounding box
                $http.get(req.url, {
                  timeout: canceler.promise,
                  params: req.params
                }).success(function(res) {
                  scope.options.results = res.results || [];
                  scope.loading = false;
                }).error(function(reason) {
                  scope.tree = {};
                  scope.loading = false;
                });
              }
            };

      }
    };
  });
})();

