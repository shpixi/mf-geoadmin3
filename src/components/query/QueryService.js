(function() {  
  goog.provide('ga_query_service');

  var module = angular.module('ga_query_service', []);

  module.provider('gaQuery', function() {
    this.$get = function($http, $log, $q, gaDebounce, gaGlobalOptions) {
      var searchUrl = gaGlobalOptions.apiUrl + '/rest/services/all/SearchServer';
      var layerUrl = gaGlobalOptions.apiUrl + '/rest/services/api/MapServer/';

      var attrInfos = { // SQL Alchemy types
        NUMERIC: {
          inputType: 'number',
          operators: ['=', '!=', '>', '<', '<=', '>=']
        },
        STRING: {
          inputType: 'text',
          operators: ['like', 'ilike', 'not like', 'not ilike']
        },
        BOOLEAN: {
          inputType: 'checkbox',
          operators: ['=']
        },
        TIME: {
          inputType: 'time',
          operators: ['=', '!=', '>', '<', '<=', '>=']
        },
        DATE: {
          inputType: 'date',
          operators: ['=', '!=', '>', '<', '<=', '>=']
        },
        DATETIME: {
          inputType: 'datetime-local',
          operators: ['=', '!=', '>', '<', '<=', '>=']
        }
      };

      // Others numeric types
      attrInfos.BIGINTEGER = attrInfos.SMALLINTEGER = attrInfos.INTEGER =
      attrInfos.FLOAT = attrInfos.DECIMAL = attrInfos.INTERVAL =
      attrInfos.NUMERIC;

      // Others string types
      attrInfos.TEXT = attrInfos.UNICODE = attrInfos.UNICODETEXT =
      attrInfos.ENUM = attrInfos.STRING;
      
      // Parse bbox string
      var parseBoxString = function(stringBox2D) {
        var extent = stringBox2D.replace('BOX(', '')
          .replace(')', '').replace(',', ' ')
          .split(' ');
        return $.map(extent, parseFloat);
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
          type: 'featureidentify',
          features: ids.join(','),
          timeEnabled: timeenabled.join(','),
          timeStamps: timestamps.join(','),
          bbox: extent.join(',')
        };
      };


      function Query() {

         // Use ESRI layer service
         this.getLayerAttributes = function(scope, bodId, params) {
           var deferred = $q.defer();
           $http.get(layerUrl + bodId, params, {
             cache: true
           }).success(function(data) {
             var attr = [];
             for (var i = 0, ii = data.fields.length; i < ii; i++) {
               var field = data.fields[i];
               attr.push({
                 label: field.name,
                 type: field.type,
                 operators: attrInfos[field.type].operators
               });
             }
             deferred.resolve(attr);
           }).error(function(data, status, headers, config) {
             $log.error('Request failed');
             $log.debug(config);
             deferred.reject(status);
           });
           return deferred.promise;
         };
         
         // Use ESRI query service 
         this.getLayerFeatures = function(scope, bodId, params) {
           var deferred = $q.defer();
           $http.get(layerUrl + bodId + '/query', params, {
             cache: true
           }).success(function(data) {
             y
             deferred.resolve(data.results);
           }).error(function(data, status, headers, config) {
             $log.error('Request failed');
             $log.debug(config);
             deferred.reject(status);
           });
           return deferred.promise;
         }
         
         // Use featureidentify service
         var canceler; 
         var bboxDebounced = gaDebounce.debounce(function(scope, layers, extent) {
           if (canceler) {
             canceler.resolve();
           }       
           var deferred = $q.defer();
           canceler = $q.defer();
           $http.get(searchUrl, {
             params: getParams(layers, extent),
             timeout: canceler.promise,
             cache: true
           }).success(function(data) {
            
            for (var i = 0; i < data.results.length; i++) {
               var result = data.results[i];  
               // The feature search using sphinxsearch uses quadindex
               // to filter results based on their bounding boxes. This is
               // in order to make the search extremely fast even for a large
               // number of features. The downside is that we will have false
               // positives in the results (features which are outside of
               // the searched box). Here, we filter out those false
               // positives based on the bounding box of the feature. Note
               // that we could refine this by using the exact geometry in
               // the future
               if (result.attrs && result.attrs.geom_st_box2d) {
                 var bbox = parseBoxString(result.attrs.geom_st_box2d);
                 if (!ol.extent.intersects(extent, bbox)) {
                   data.results.splice(i, 1);
                   i--
                 }
               }
             }
             deferred.resolve(data.results);
           }).error(function(data, status, headers, config) {
             $log.error('Request failed');
             $log.debug(config);
             deferred.reject(status);
           });
           return deferred.promise;
         }, 200, false, false);
         this.getLayersFeaturesByBbox = bboxDebounced; 
      };
      return new Query();
    }

  });
})();

