(function() {
  goog.provide('ga_featuretree_directive');

  goog.require('ga_map_service');
  goog.require('ga_styles_service');

  var module = angular.module('ga_featuretree_directive', [
    'ga_map_service',
    'ga_styles_service',
    'pascalprecht.translate'
  ]);

  /**
   * TODOs:
   * - create all sphinxsearch indices (querable layers)
   * - translations
   * - rectangle drawing always active. auto-open accordion
   **/

  module.directive('gaFeaturetree',
      function($rootScope, $compile, $timeout, $http, $q, $translate, $sce,
          gaLayers, gaDefinePropertiesForLayer, gaStyleFactory, 
          gaMapClick, gaPreviewFeatures, gaLayerFilters,
          gaBrowserSniffer) {

        var getTranslatedLabel = function(obj) {
          var possibleKey = 'label_' + $translate.use();
          if (angular.isDefined(obj[possibleKey])) {
            return obj[possibleKey];
          } else {
            return obj.label;
          }
        };

        var parseBoxString = function(stringBox2D) {
          var extent = stringBox2D.replace('BOX(', '')
            .replace(')', '').replace(',', ' ')
            .split(' ');
          return $.map(extent, parseFloat);
        };

        return {
          restrict: 'A',
          replace: true,
          templateUrl: 'components/featuretree/partials/featuretree.html',
          scope: {
            map: '=gaFeaturetreeMap',
            options: '=gaFeaturetreeOptions',
            isActive: '=gaFeaturetreeActive'
          },
          link: function(scope, element, attrs) {
            var timeoutPromise = null;
            var canceler = null;
            var map = scope.map;
            var parser = new ol.format.GeoJSON();
            var dragBoxStyle = gaStyleFactory.getStyle('selectrectangle');
            var selectionRecFeature = new ol.Feature();
            var selectionRecOverlay = new ol.FeatureOverlay({
              map: map,
              style: dragBoxStyle
            });


            scope.noResults = function() {
              // We can't use undefined or null for scope.tree
              // because it would break the ng-repeat in the partial.
              // Therefore, we have to have this dummy for loop to
              // determine if we have results or not
              var dummy;
              for (dummy in scope.tree) {
                return false;
              }
              return true;
            };

            var updateTree = function(features) {
              gaPreviewFeatures.clearHighlight();
              var res = features;
              var tree = {}, i, li, j, lj, layerId, newNode, oldNode,
                  feature, oldFeature, result, bbox, ext, searchExtent;

              if (selectionRectFeature.getGeometry()) {
                searchExtent = selectionRectFeature.getGeometry().getExtent();
              }

              for (i = 0, li = res.length; i < li; i++) {
                result = res[i];

                // The feature search using sphinxsearch uses quadindex
                // to filter results based on their bounding boxes. This is
                // in order to make the search extremely fast even for a large
                // number of features. The downside is that we will have false
                // positives in the results (features which are outside of
                // the searched box). Here, we filter out those false
                // positives based on the bounding box of the feature. Note
                // that we could refine this by using the exact geometry in
                // the future
                if (result.attrs && result.attrs.geom_st_box2d &&
                    searchExtent) {
                  bbox = parseBoxString(result.attrs.geom_st_box2d);
                  if (!ol.extent.intersects(searchExtent, bbox)) {
                    continue;
                  }
                }

                layerId = result.layerBodId || result.attrs.layer;
                newNode = tree[layerId];
                oldNode = scope.tree[layerId];
                feature = undefined;

                if (!angular.isDefined(newNode)) {
                  newNode = {
                    label: '',
                    features: [],
                    open: oldNode ? oldNode.open : true
                  };
                  tree[layerId] = newNode;
                }

                //look if feature exists already. We do this
                //to avoid loading the same feature again and
                //to preserve state (selected)
                if (oldNode) {
                  for (j = 0, lj = oldNode.features.length; j < lj; j++) {
                    oldFeature = oldNode.features[j];
                    if (oldFeature.id === (result.id || result.attrs.id)) {
                      feature = oldFeature;
                      break;
                    }
                  }
                }
                if (!angular.isDefined(feature)) {
                  feature = {
                    info: '',
                    geometry: null,
                    id: result.id || result.attrs.id,
                    layer: layerId,
                    label: getTranslatedLabel((result.attrs || result))
                  };
                }
                newNode.features.push(feature);
              }
              //assure that label contains number of items
              angular.forEach(tree, function(value, key) {
                var l = gaLayers.getLayer(key).label +
                        ' (' + value.features.length + ' ' +
                        getItemText(value.features.length) + ')';
                value.label = l;

                function getItemText(number) {
                  if (number <= 1) {
                    return $translate.instant('item');
                  }
                  return $translate.instant('items');
                }
              });
              scope.tree = tree;
              scope.$emit('gaUpdateFeatureTree', tree);
            };

            var loadGeometry = function(feature, cb) {
              var featureUrl;
              if (!feature.geometry) {
                featureUrl = scope.options.htmlUrlTemplate
                             .replace('{Layer}', feature.layer)
                             .replace('{Feature}', feature.id)
                             .replace('/htmlPopup', '');
                $http.get(featureUrl, {
                  timeout: canceler.promise,
                  params: {
                    geometryFormat: 'geojson'
                  }
                }).success(function(result) {
                  feature.geometry = result.feature;
                  cb();
                }).error(function() {
                  feature.geometry = null;
                  cb();
                });
              } else {
                //make sure it's async as the other cb() calls
                $timeout(function() {
                  cb();
                }, 0, false);
              }
            };

            scope.tree = {};

            scope.highlightFeature = function(feature) {
              loadGeometry(feature, function() {
                if (feature.geometry) {

                  gaPreviewFeatures.highlight(map,
                      parser.readFeature(feature.geometry));
                }
              });
            };

            scope.clearHighlight = function() {
              gaPreviewFeatures.clearHighlight();
            };

            var selectAndTriggerTooltip = function(feature) {
              loadGeometry(feature, function() {
                if (!isFeatureSelected(feature)) {
                  featureSelected = feature;
                  if (feature.geometry) {
                    $rootScope.$broadcast('gaTriggerTooltipRequest', {
                      features: [feature.geometry],
                      onCloseCB: function() {
                        if (isFeatureSelected(feature)) {
                          featureSelected = null;
                        }
                      }
                    });
                  }
                }
              });
            };

            var featureSelected;
            var isFeatureSelected = function(feature) {
               return (feature === featureSelected);
            };
            scope.getCssSelected = function(feature) {
               return isFeatureSelected(feature) ? 'selected' : '';
            };

            var ignoreOneClick = false;
            var fromMouseDown = false;
            scope.onFocus = function(evt, feature) {
              if (!isFeatureSelected(feature)) {
                if (fromMouseDown) {
                  ignoreOneClick = true;
                }
                selectAndTriggerTooltip(feature);
              }
            };

            scope.onMouseDown = function(evt, feature) {
              fromMouseDown = true;
            };

            scope.onClick = function(evt, feature) {
              fromMouseDown = false;
              if (ignoreOneClick) {
                ignoreOneClick = false;
              } else {
                if (isFeatureSelected(feature)) {
                  $rootScope.$broadcast('gaTriggerTooltipInitOrUnreduce');
                } else {
                  selectAndTriggerTooltip(feature);
                }
              }
            };

            scope.onKeyDown = function(evt, feature) {
              var focusFn, el;
              //upKey
              if (evt.keyCode == 38) {
                if (evt.target &&
                    evt.target.previousElementSibling) {
                  feature.selected = false;
                  $timeout(function() {
                    evt.target.previousElementSibling.focus();
                  }, 0);
                  evt.preventDefault();
                }
              //downKey
              } else if (evt.keyCode == 40) {
                if (evt.target &&
                    evt.target.nextElementSibling) {
                  feature.selected = false;
                  $timeout(function() {
                    evt.target.nextElementSibling.focus();
                  }, 0);
                  evt.preventDefault();
                }
              }
            };

            scope.recenterToFeature = function(evt, feature) {
              evt.stopPropagation();
              gaPreviewFeatures.zoom(map, parser.readFeature(feature.geometry));
            };

            var showSelectionRectangle = function() {
              if (!selectionRecOverlay.getFeatures().getLength() &&
                  selectionRecFeature.getGeometry()) {
                selectionRecOverlay.addFeature(selectionRecFeature);
              }
            };

            var hideSelectionRectangle = function() {
              if (selectionRecOverlay.getFeatures().getLength()) {
                selectionRecOverlay.removeFeature(selectionRecFeature);
              }
            };

            // We consider this component is activated when a box is drawn
            var activate = function() {
              showSelectionRectangle();
            };

            var deactivate = function() {
               // Clean the displa in any case
               $rootScope.$broadcast('gaTriggerTooltipInit');
               scope.clearHighlight();
               hideSelectionRectangle();
            };


            // Watchers and scope events
            scope.$watch('isActive', function(newVal, oldVal) {
              cancel();
              if (newVal != oldVal) {
                if (newVal) {
                  activate();
                } else {
                  deactivate();
                }
              }
            });

            scope.$watch('options.results', function(features) {
              updateTree(features);
            });
            scope.$watch('options.resultsExtent', function(geometry) {
              selectionRecFeature.setGeometry(geometry);
              if (!geometry) {
                deactivate();
              } else {
                scope.isActive = true;
                activate();
              }
            });
          }
        };

      }
  );
})();

