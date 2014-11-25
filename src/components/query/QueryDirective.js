(function() {
  goog.provide('ga_query_directive');

  goog.require('ga_map_service');

  var module = angular.module('ga_query_directive', [
    'ga_map_service'
  ]);

  module.controller('GaQueryDirectiveController', function($scope, $http) {
    $scope.queryType = 0;
    $scope.searchableLayers = [];
    $scope.queries = [{
      layer: null,
      attribute: null,
      operator: null
    }];
    
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
    }

    // Load attributes of the selected layer in the select box
    $scope.loadAttributes = function(query) {
      if (!query.layer.attributes) {
        $http.get($scope.options.layerUrl + query.layer.bodId)
          .success(function(data) {
            var attr = [];
            for (var i = 0, ii = data.fields.length; i < ii; i++) {
              var field = data.fields[i]; 
              attr.push({
                label: field.name,
                type: field.type.toLowerCase(),
                operators: $scope.options.operatorsByType[field.type.toLowerCase()]
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
    $scope.add = function(evt, idx) {
      evt.stopPropagation();
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
    $scope.remove = function(evt, idx) {
      evt.stopPropagation();
      $scope.queries.splice(idx, 1);
    };

  });

  module.directive('gaQuery', function($http, gaLayerFilters) {

    var getParamsByLayer = function(queries, extent) {
      /* Layer service */
      // In this case queries contains all the query on one layer */
      var test = [];
      var paramsByLayer = {};

      angular.forEach(queries, function(query, idx) {
        if (!paramsByLayer[query.layer.bodId]) {
          paramsByLayer[query.layer.bodId] = {
            bodId: query.layer.bodId,
            params: {}
          };
          test.push(paramsByLayer[query.layer.bodId]);
        }
        var params = paramsByLayer[query.layer.bodId].params; 

        // Bbox condition
        if (extent && !params.geometry) {
          params.geometry = extent;
        }

        // Where condition
        var where = (params.where) ? params.where + ' and ' : '';
        where += query.attribute.label + ' ' + query.operator + ' ' +
            ((query.attribute.type == 'text') ?
            '\'' + query.value + '\'' : query.value);
        params.where = where;
      });
      return test;
    };

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
        scope.search = function(evt) {
          evt.stopPropagation();
          var layersBodId = scope.queries[0].layer,
              req, searchExtent;
          if (layersBodId) {
            scope.options.results = [];
            var params = getParamsByLayer(scope.queries);
            angular.forEach(params, function(paramsByLayer) {
              $http.get(scope.options.layerUrl + paramsByLayer.bodId +
                  '/query', {
                params: paramsByLayer.params
              }).success(function(res) {
                scope.options.results = scope.options.results.concat(res.results);
              }).error(function(reason) {
                scope.options.results = {};
              });
            });
            //Search server Request
            /*$http.get(scope.options.layerUrl, {
              params: getParams(scope.queries)
            }).success(function(res) {
              scope.options.results = res;
              window.console.debug(res);
            }).error(function(reason) {
              scope.options.results = {};
            });*/
          }
        };
      }
    };
  });
})();

