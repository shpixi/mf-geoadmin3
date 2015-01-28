(function() {
  goog.provide('ga_geolocation_directive');

  goog.require('ga_permalink');
  goog.require('ga_styles_service');
  goog.require('ga_throttle_service');

  var module = angular.module('ga_geolocation_directive', [
    'ga_permalink',
    'ga_styles_service',
    'ga_throttle_service'
  ]);

  module.directive('gaGeolocation', function($parse, $window,
      gaPermalink, gaStyleFactory, gaThrottle, gaMapUtils) {
    return {
      restrict: 'A',
      replace: true,
      scope: {
        map: '=gaGeolocationMap'
      },
      templateUrl: 'components/geolocation/partials/geolocation.html',
      link: function(scope, element, attrs) {
        var btnElt = element;

        if (!('geolocation' in $window.navigator)) {
          btnElt.addClass('ga-geolocation-error');
          return;
        }

        // This boolean defines if the user has moved the map itself after the
        // first change of position.
        var userTakesControl = false;
        // Defines if the geolocation control is zooming
        var geolocationZooming = false;
        var map = scope.map;
        var view = map.getView();
        var accuracyFeature = new ol.Feature();
        var positionFeature = new ol.Feature(new ol.geom.Point([0, 0]));
        var headingFeature = new ol.Feature(new ol.geom.Point([0, 0]));
        var headingStyleFunction = function(rotation) {
          return new ol.style.Style({
            image: new ol.style.Icon({
              anchorXUnits: 'fraction',
              anchorYUnits: 'fraction',
              opacity: 1,
              rotation: rotation,
              src: 'components/geolocation/style/orientation_8.png'
            })
          });
        };
        var shapeFeature = new ol.Feature({
            geometry: new ol.geom.Point([0, 0])
        });
        var fill = new ol.style.Fill({color: 'red'});
        //Use a style function. TODO: use StyleService.js
        var shapeStyleFunction = function(angle) {return new ol.style.Style({
            image: new ol.style.RegularShape({
              fill: fill,
              points: 3,
              radius: 6,
              angle: angle
            })
          });
        };
        var featuresOverlay = new ol.FeatureOverlay({
          features: [accuracyFeature, positionFeature, headingFeature],
          style: gaStyleFactory.getStyle('geolocation')
        });
        var geolocation = new ol.Geolocation({
          trackingOptions: {
            maximumAge: 10000,
            enableHighAccuracy: true,
            timeout: 600000
          }
        });

        // Animation
        // used to having a zoom animation when we click on the button,
        // but not when we are tracking the position.
        var first = true;
        var currentAccuracy = 0;
        var locate = function() {
          geolocationZooming = true;
          var dest = geolocation.getPosition();
          if (dest) {
            var source = view.getCenter();
            var dist = Math.sqrt(Math.pow(source[0] - dest[0], 2),
                Math.pow(source[1] - dest[1], 2));
            var duration = Math.min(
                Math.sqrt(300 + dist / view.getResolution() * 1000), 3000
            );
            var start = +new Date();
            var pan = ol.animation.pan({
              duration: duration,
              source: source,
              start: start
            });
            var bounce;
            if (first) {
              first = false;
              var extent = [
                dest[0] - currentAccuracy,
                dest[1] - currentAccuracy,
                dest[0] + currentAccuracy,
                dest[1] + currentAccuracy
              ];
              var size = map.getSize();
              var resolution = Math.max(
                (extent[2] - extent[0]) / size[0],
                (extent[3] - extent[1]) / size[1]);
              resolution = Math.max(view.constrainResolution(resolution, 0, 0),
                2.5);
              bounce = ol.animation.bounce({
                duration: duration,
                resolution: Math.max(view.getResolution(), dist / 1000,
                    // needed to don't have up an down and up again in zoom
                    resolution * 1.2),
                start: start
              });
              var zoom = ol.animation.zoom({
                resolution: view.getResolution(),
                duration: duration,
                start: start
              });
              map.beforeRender(pan, zoom, bounce);
              view.setCenter(dest);
              view.setResolution(resolution);
            } else if (!userTakesControl) {
              map.beforeRender(pan);
              view.setCenter(dest);
            }
          }
          geolocationZooming = false;
        };

        //HEADING - DEV

        // Orientation control events

        var deviceOrientation = new ol.DeviceOrientation();

        var headingUpdate = function() {
          if (deviceOrientation.getHeading() != undefined) {
            var heading = -deviceOrientation.getHeading();
            heading -= window['orientation'] * Math.PI / 180.0;
            if (btnStatus == 1) {
              updateHeadingFeature();
            }
            if (btnStatus == 2) {
              map.beforeRender(ol.animation.rotate({
                rotation: view.getRotation(),
                duration: 350,
                easing: ol.easing.linear
              }));
              map.getView().setRotation(heading);
              resetHeadingNorth();
            }
          }
        };

        //use the new ThrottleService.js, which should be refactored with
        //the DebounceService.js
        var headingUpdateThrottled = gaThrottle.throttle(headingUpdate,
            45);

        var resetHeadingNorth = function() {
          if (deviceOrientation.getHeading()) {
            var xPos = geolocation.getPosition()[0];
            var yPos = geolocation.getPosition()[1];
            var offset = -28;
            var rotation = deviceOrientation.getHeading();
            shapeFeature.getGeometry().setCoordinates([xPos + offset *
                Math.sin(rotation + Math.PI), yPos + offset *
                    Math.cos(rotation + Math.PI)]);
            shapeFeature.setStyle(shapeStyleFunction(0));
            headingFeature.setStyle(headingStyleFunction(0));
            headingFeature.getGeometry().setCoordinates([xPos, yPos]);
          }
        };

        //FIXME. At the moment no gaRotate service
        /*var resetMapToNorth = function() {
          map.beforeRender(ol.animation.rotate({
            rotation: view.getRotation(),
            duration: 1000,
            easing: ol.easing.easeOut
          }));
          map.getView().setRotation(0);
        };*/

        deviceOrientation.on('change:heading', function(event) {
          var heading = -deviceOrientation.getHeading();
          if (Math.abs(heading != view.getRotation()) > 0) {
            headingUpdateThrottled();
          }
        });

        var updatePositionFeature = function() {
          if (geolocation.getPosition()) {
            positionFeature.getGeometry().setCoordinates(
               geolocation.getPosition());
          }
        };

        var updateAccuracyFeature = function() {
          if (geolocation.getPosition() && geolocation.getAccuracy()) {
            accuracyFeature.setGeometry(new ol.geom.Circle(
                geolocation.getPosition(), geolocation.getAccuracy()));
          }
        };

        var updateHeadingFeature = function() {
          if (deviceOrientation.getHeading()) {
            var xPos = geolocation.getPosition()[0];
            var yPos = geolocation.getPosition()[1];
            var offset = 28;
            var rotation = deviceOrientation.getHeading();
            shapeFeature.getGeometry().setCoordinates([xPos + offset *
                Math.sin(rotation), yPos + offset * Math.cos(rotation)]);
            shapeFeature.setStyle(shapeStyleFunction(rotation));
            headingFeature.getGeometry().setCoordinates([xPos, yPos]);
            headingFeature.setStyle(headingStyleFunction(rotation));
          }
        };

        // Geolocation control events
        geolocation.on('change:position', function(evt) {
          btnElt.removeClass('ga-geolocation-error');
          btnElt.addClass('ga-geolocation-tracking');
          locate();
          updatePositionFeature();
          updateAccuracyFeature();
        });

        geolocation.on('change:accuracy', function(evt) {
          currentAccuracy = geolocation.getAccuracy();
          updateAccuracyFeature();
        });

        geolocation.on('change:tracking', function(evt) {
          var tracking = geolocation.getTracking();
          if (tracking) {
            first = true;
            userTakesControl = false;
            featuresOverlay.setMap(map);
          } else {
            // stop tracking
            btnElt.removeClass('ga-geolocation-tracking');
            featuresOverlay.setMap(null);
          }
        });

        geolocation.on('error', function() {
          btnElt.removeClass('ga-geolocation-tracking');
          btnElt.addClass('ga-geolocation-error');
        });

        // Geolocation control bindings
        geolocation.bindTo('projection', view);

        // View events
        var updateUserTakesControl = function() {
          if (!geolocationZooming) {
            userTakesControl = true;
          }
        };
        view.on('change:center', updateUserTakesControl);
        view.on('change:resolution', updateUserTakesControl);

        // Button event
        var btnStatus;
        if (btnStatus == undefined) {
          btnStatus = 0;
        }
        var tracking = geolocation.getTracking();
        btnElt.bind('click', function(e) {
          e.preventDefault();
          //Set 3-state button
          if (btnStatus < 2) {
            btnStatus++;
          } else {
            btnStatus = 0;
            tracking = false;
            geolocation.setTracking(tracking);
            deviceOrientation.setTracking(tracking);
            gaMapUtils.resetMapToNorth(map, view);
          }

         if (btnStatus == 1) {
            tracking = true;
            geolocation.setTracking(tracking);
            deviceOrientation.setTracking(tracking);
          } else if (btnStatus == 2) {
            btnElt.removeClass('ga-geolocation-tracking');
            btnElt.addClass('ga-geolocation-northarrow');
            tracking = true;
            geolocation.setTracking(tracking);
            deviceOrientation.setTracking(tracking);
            // Button is rotated according to map rotation
            view.on('change:rotation', function(evt) {
              setButtonRotation(evt.target.getRotation() * 180 / Math.PI);
            });
          }
          //FIXME. There is no service for gaRotate
          var setButtonRotation = function(rotation) {
            var rotateString = 'rotate(' + rotation + 'deg)';
            element.css({
              'transform': rotateString,
              '-ms-transform': rotateString,
              '-webkit-transform': rotateString
            }).toggleClass('ga-rotate-enabled', !(rotation == 0));
          };

          if (tracking) {
            btnElt.addClass('ga-geolocation-tracking');
          } else {
            btnElt.removeClass('ga-geolocation-tracking');
            btnElt.removeClass('ga-geolocation-northarrow');
          }

          scope.$apply(function() {
            gaPermalink.updateParams({
              geolocation: tracking ? 'true' : 'false'
            });
          });
        });

        // Init with permalink
        geolocation.setTracking(gaPermalink.getParams().geolocation == 'true');
      }
    };
  });
})();
