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

        // This object with boolean properties defines either:
        // geolocation: if the user has moved the map itself after the
        // first change of position.
        // rotation: if the user has touched-rotated the map on btn state 2
        var userTakesControl = {geolocation: false, rotation: false};
        // Defines if the heading of the map is being rendered
        var mapHeadingRendering = false;
        // Defines if the geolocation control is zooming
        var geolocationZooming = false;
        var map = scope.map;
        var view = map.getView();
        var accuracyFeature = new ol.Feature();
        var headingFeature = new ol.Feature(new ol.geom.Point([0, 0]));
        var headingStyleFunction = function(rotation) {
          return new ol.style.Style({
            image: new ol.style.Icon({
              anchorXUnits: 'fraction',
              anchorYUnits: 'fraction',
              opacity: 1,
              rotation: rotation,
              src: 'components/geolocation/style/geolocation_heading_marker.png'
            })
          });
        };

        var featuresOverlay = new ol.FeatureOverlay({
          features: [accuracyFeature, headingFeature],
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
            } else if (!userTakesControl.geolocation) {
              map.beforeRender(pan);
              view.setCenter(dest);
            }
          }
          geolocationZooming = false;
        };

        // Orientation control events
        var deviceOrientation = new ol.DeviceOrientation();

        var headingUpdate = function() {
          var heading = deviceOrientation.getHeading();
          if (angular.isDefined(heading)) {
            if (btnStatus == 1) {
              updateHeadingFeature();
            }
            if (btnStatus == 2) {
              if (userTakesControl.rotation == false) {
                mapHeadingRendering = true;
                map.beforeRender(ol.animation.rotate({
                  rotation: view.getRotation(),
                  duration: 350,
                  easing: ol.easing.linear
                }));
                map.getView().setRotation(-heading);
                setHeadingFeatureAngle(0);
                mapHeadingRendering = false;
              } else {
                updateHeadingFeature();
              }
            }
          }
        };

        //use the new ThrottleService.js, which should be refactored with
        //the DebounceService.js
        var headingUpdateThrottled = gaThrottle.throttle(headingUpdate,
            300);

        var setHeadingFeatureAngle = function(angle) {
          if (deviceOrientation.getHeading()) {
            var xPos = geolocation.getPosition()[0];
            var yPos = geolocation.getPosition()[1];
            var rotation = deviceOrientation.getHeading();
            headingFeature.setStyle(headingStyleFunction(angle));
            headingFeature.getGeometry().setCoordinates([xPos, yPos]);
          }
        };

        var currHeading = 0;
        deviceOrientation.on('change:heading', function(event) {
          var heading = deviceOrientation.getHeading();
          if (heading < currHeading - 0.001 || currHeading + 0.001 < heading) {
            currHeading = heading;
            headingUpdateThrottled();
          }
        });

        var updatePositionFeature = function() {
          if (geolocation.getPosition()) {
            headingFeature.getGeometry().setCoordinates(
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
            var rotation = deviceOrientation.getHeading();
            headingFeature.setStyle(headingStyleFunction(rotation +
              view.getRotation()));
          }
        };

        // Geolocation control events
        geolocation.on('change:position', function(evt) {
          btnElt.removeClass('ga-geolocation-error');
          btnElt.addClass('ga-geolocation-tracking');
          locate();
          updatePositionFeature();
          updateAccuracyFeature();
          updateHeadingFeature();
        });

        geolocation.on('change:accuracy', function(evt) {
          currentAccuracy = geolocation.getAccuracy();
          updateAccuracyFeature();
        });

        geolocation.on('change:tracking', function(evt) {
          var tracking = geolocation.getTracking();
          if (tracking) {
            first = true;
            userTakesControl.geolocation = false;
            userTakesControl.rotation = false;
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
          userTakesControl.geolocation = !geolocationZooming;
          userTakesControl.rotation = !mapHeadingRendering;
        };
        view.on('change:center', updateUserTakesControl);
        view.on('change:resolution', updateUserTakesControl);
        view.on('change:rotation', updateUserTakesControl);

        // Button events
        var btnStatus = 0;
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

          //FIXME. Maybe put in gaMapUtils as well
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
