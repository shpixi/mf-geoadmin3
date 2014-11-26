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
        .then(function(attributes){
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
    
    // Go through the queries and transform it to a requestable object 
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
 
    // Lauch a search
    $scope.searchByAttributes = function() {
      var features = [];
      angular.forEach(
        getParamsByLayer($scope.queries),
        function(paramsByLayer) {
          gaQuery.getLayerFeatures(
            $scope,
            paramsByLayer.bodId,
            paramsByLayer.params
          ).then(function(layerFeatures){
            $scope.options.results = features.concat(layerFeatures);
          });
        }
      );
    };
  });

  module.directive('gaQuery', function($http, gaLayerFilters, gaStyleFactory) {

    var getParams = function(queries, extent) {
      /* SearchServer
      var bodIds = [], timeEnabled = [], timeStamps = [], attributes = [],
          operators = [], values = [],
          params = {
            type: 'featuresearch',
            bbox: extent ? extent.join(',') : undefined
          };
      angular.forEach(queries, function(query) {
        var l = query.layer;
        if (l) {
          bodIds.push(l.bodId);
          timeEnabled.push(l.timeenabled);
          timeStamps.push((l.time && l.time.substr(0, 4) != '9999') ?
              l.time.substr(0, 4) : '');
          attributes.push(query.attribute.label);
          operators.push(query.operator);
          values.push(query.value);
        }
      });
      return angular.extend(params, {
        searchText: values[0],
        features: bodIds.join(','),
        timeEnabled: timeEnabled.join(','),
        timeStamps: timeStamps.join(','),
        attributes: attributes.join(','),
        operators: operators.join(','),
        values: values.join(',')

      });*/
    };

    var parser = new ol.format.GeoJSON();
    var dragBox = new ol.interaction.DragBox({
      condition: function(evt) {
        //MacEnvironments don't get here because the event is not
        //recognized as mouseEvent on Mac by the google closure.
        //We have to use the apple key on those devices
        return evt.originalEvent.ctrlKey ||
            (gaBrowserSniffer.mac && evt.originalEvent.metaKey);
      },
      style: gaStyleFactory.getStyle('selectrectangle')
    });

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
        initInteraction(map);
        // Add the fdragbox interaction
            var map = scope.map;
            var selectionRecFeature = new ol.Feature();
            var selectionRecOverlay = new ol.FeatureOverlay({
              map: map,
              style: gaStyleFactory.getStyle('selectrectangle')
            });
                        map.addInteraction(dragBox);
            // Events on dragbox
            dragBox.on('boxstart', function(evt) {
              //deactivate();
              console.log('boxstart');
            });

            dragBox.on('boxend', function(evt) {
              //selectionRecFeature.setGeometry(scope.dragBox.getGeometry());
              //scope.isActive = true;
              //activate();
            });

      
      }
    };
  });
})();

