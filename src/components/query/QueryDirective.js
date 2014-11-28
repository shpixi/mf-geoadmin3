(function() {
  goog.provide('ga_query_directive');

  goog.require('ga_map_service');
  goog.require('ga_query_service');
  goog.require('ga_storage_service');

  var module = angular.module('ga_query_directive', [
    'ga_map_service',
    'ga_query_service',
    'ga_storage_service'
  ]);

  module.controller('GaQueryDirectiveController', function($scope, $http,
      $translate, gaLayers, gaQuery, gaMapUtils, gaStorage) {
    var queryKey = 'ga_query_saved';
    var stored;
    $scope.queryType = 0;
    $scope.searchableLayers = [];
    $scope.queriesSaved = angular.fromJson(gaStorage.getItem(queryKey) || '[]');
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
      if (!query.layer.attributes) {
        gaQuery.getLayerAttributes($scope, query.layer.bodId)
          .then(function(attributes) {
            query.layer.attributes = attributes;
            applyAttrValues(query);
          });
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

    // Remove a query saved
    $scope.removeQuerySaved = function(querySaved) {
      for (var i = 0, ii = $scope.queriesSaved.length; i < ii; i++) {
        if ($scope.queriesSaved[i].label == querySaved.label) {
          $scope.queriesSaved.splice(i, 1);
          break;
        }
      }
      gaStorage.setItem(queryKey, angular.toJson($scope.queriesSaved));
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
      gaQuery.getLayersFeaturesByBbox($scope, $scope.searchableLayers,
          $scope.extent)
        .then(function(layerFeatures) {
          $scope.options.results = layerFeatures;
        },function(reason) {
          $scope.options.results = [];
        });
    };

    // Launch a complex search
    $scope.searchByAttributes = function() {
      var features = [];
      var params = getParamsByLayer($scope.queries);
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
            features = features.concat(layerFeatures);
            $scope.options.results = features;
          },function(reason) {
            $scope.options.results = [];
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

    // Extract only informations needed to save the current query
    var toSaveFormat = function(queries) {
      var queriesToSave = [];
      for (var i = 0, ii = queries.length; i < ii; i++) {
        var query = queries[i];
        if (query.layer && query.attribute && query.operator && query.value) {
          var queryToSave = {
            bodId: query.layer.bodId,
            attrName: query.attribute.label,
            operator: query.operator,
            value: query.value
          };
          queriesToSave.push(queryToSave);
        }
      }
      return queriesToSave;
    };
    var applyAttr = function(query, attrName) {
      for (var j = 0, jj = query.layer.attributes.length; j < jj; j++) {
        if (query.layer.attributes[j].label == attrName) {
          query.attribute = query.layer.attributes[j];
        }
      }
    };

    var fromSaveFormat = function(queries) {
      var queriesToRestore = [];
      for (var i = 0, ii = queries.length; i < ii; i++) {
        var query = queries[i];
        var queryToRestore = {};
        // find the layer
        var layerOnMap = gaMapUtils.getMapOverlayForBodId($scope.map,
            query.bodId);
        if (!layerOnMap) {
          layerOnMap = gaLayers.getOlLayerById(query.bodId);
          if (!layerOnMap) {
            // can't display the display so we remove this query
            // TODO: warn the user ?
            continue;
          }
          $scope.map.addLayer(layerOnMap);
        }
        queryToRestore.layer = layerOnMap;

        if (queryToRestore.layer.attributes) {
          applyAttr(queryToRestore, query.attrName);
        } else {
          // load attributes
          gaQuery.getLayerAttributes($scope, queryToRestore.layer.bodId)
            .then(function(attributes) {
              queryToRestore.layer.attributes = attributes;
              applyAttr(queryToRestore, query.attrName);
              $scope.load(queries); // Reload until all layer have finished
            });
          return;
        }
        queryToRestore.operator = query.operator;
        queryToRestore.value = query.value;
        queriesToRestore.push(queryToRestore);
      }
      return queriesToRestore;
    };

    $scope.save = function() {
      var label = prompt($translate('query_name_prompt'), 'Query n ' +
          $scope.queriesSaved.length + 1);
      if (label) {
        var saved = toSaveFormat($scope.queries);
        $scope.queriesSaved.push({
          label: label,
          queries: saved
        });
        gaStorage.setItem(queryKey, angular.toJson($scope.queriesSaved));
      }
    };
    $scope.load = function(queries) {
      // load attributes
      $scope.queries = fromSaveFormat(queries);
    };
    $scope.reset = function(queries) {
      $scope.queries = [{
        layer: null,
        attribute: null,
        operator: null,
        value: null
      }];
    };
    $scope.reset(); // Init queries value
  });

  module.directive('gaQuery', function($http, gaBrowserSniffer, gaLayerFilters,
      gaStyleFactory) {
    var parser = new ol.format.GeoJSON();
    var dragBox, boxOverlay;
    var dragBoxStyle = gaStyleFactory.getStyle('selectrectangle');
    var boxFeature = new ol.Feature();
    var boxOverlay = new ol.FeatureOverlay({
      style: dragBoxStyle
    });
    boxOverlay.addFeature(boxFeature);

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
            if (scope.searchableLayers.length == 0) {
              scope.$apply();
            } else {
              scope.searchByBbox();
            }
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

        scope.$watch('queryType', function(newVal, oldVal) {
          if (newVal != oldVal) {
            if (newVal == 0) {
              showBox();
            } else {
              hideBox();
            }
            scope.search();
          }
        });

        var currentYear;
        scope.$on('gaTimeSelectorChange', function(event, newYear) {
          if (newYear !== currentYear) {
            currentYear = newYear;
            if (scope.queryType == 0) {
              scope.search();
            }
          }
        });
      }
    };
  });
})();

