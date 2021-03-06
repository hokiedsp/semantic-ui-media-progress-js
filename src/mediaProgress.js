/*
 * # jQuery plug-in based on Semantic UI Progress module for media playback progress bar
 */

import "./mediaProgress.css";

(function($, window, document, undefined) {
  "use strict";

  window =
    typeof window != "undefined" && window.Math == Math
      ? window
      : typeof self != "undefined" && self.Math == Math
        ? self
        : Function("return this")();

  var global =
    typeof window != "undefined" && window.Math == Math
      ? window
      : typeof self != "undefined" && self.Math == Math
        ? self
        : Function("return this")();

  $.fn.mediaProgress = function(parameters) {
    var $allModules = this,
      // hasTouch       = ('ontouchstart' in document.documentElement),
      query = arguments[0],
      methodInvoked = typeof query == "string",
      queryArguments = [].slice.call(arguments, 1),
      returnedValue;

    $allModules.each(function() {
      var settings = $.isPlainObject(parameters)
          ? $.extend(true, {}, $.fn.mediaProgress.settings, parameters)
          : $.extend({}, $.fn.mediaProgress.settings),
        metadata = settings.metadata,
        namespace = settings.namespace,
        selector = settings.selector,
        error = settings.error,
        namespace = settings.namespace,
        eventNamespace = "." + namespace,
        moduleNamespace = "module-" + namespace,
        mediaEventNamespace = ".media-" + namespace,
        element = this,
        $module = $(this),
        instance = $module.data(moduleNamespace),
        $bar = $(this).find(selector.bar),
        $cursor = $(this).find(selector.cursor),
        $media = null,
        $marker,
        playing = false,
        animeDuration = false,
        module;

      const _find_pos = obj => {
          return obj.getBoundingClientRect().left;
        },
        _time2px = t => {
          let media = $media[0];
          if (t < 0) t = 0;
          else if (t > media.duration) t = media.duration;
          return (t / media.duration) * element.clientWidth;
        },
        _px2time = px => {
          let value = px / element.clientWidth;
          if (value < 0) value = 0;
          else if (value > 1) value = 1;
          return ($media[0].duration * value).toFixed(3);
        },
        _marker_id = id => {
          let $marker;
          if (typeof id == "string") return module.get.marker.$(id);
          else if (id instanceof HTMLElement) return $(id);
          else if (typeof id == "number")
            return $module.find(".marker").slice(id, id + 1);
          else if (id instanceof jQuery && id.hasClass("marker")) return id;
          else {
            module.verbose("Invalid marker id given:", id);
            return $();
          }
        };

      module = {
        initialize: function() {
          module.debug("Initializing media progress bar", settings);

          // create Semantic-UI progress module
          let progressSettings = {
            duration: 250,
            autoSuccess: false,
            showActivity: false,
            precision: 100
          };
          $module.progress(
            $.isPlainObject(progressSettings)
              ? $.extend(true, progressSettings, parameters)
              : progressSettings
          );

          $module.addClass("disabled");
          $cursor.addClass("hide");

          module.read.metadata();
          module.read.settings();

          module.bind.events();

          module.instantiate();
        },

        instantiate: function() {
          module.verbose("Storing instance of mediaProgress", module);
          instance = module;
          $module.data(moduleNamespace, module);
        },

        destroy: function() {
          module.verbose("Destroying previous mediaProgress for", $module);

          $module.progress("destroy");
          module.detach();
          $module.removeData(moduleNamespace);
          instance = undefined;
        },

        attach: function(media) {
          if ($media) module.detach(media);
          if (!media) return;
          if (typeof media == "string" || media instanceof HTMLMediaElement) {
            media = $(media);
          } else if (!(media instanceof jQuery)) {
            throw "Argument must be id string, DOM HTMLMediaElement, or jQuery object.";
          }

          // assign the first media element
          media = media
            .filter((i, elem) => {
              return elem instanceof HTMLMediaElement;
            })
            .first();
          if (!media)
            throw "Argument must contain at least one DOM HTMLMediaElement.";

          $media = media;
          module.bind.mediaEvents();

          module.debug("Attached to", $media[0]);

          // if media is already loaded, enable
          if ($media[0].currentSrc) {
            module.debug("Media already loaded", $media[0]);
            $module.removeClass("disabled");
            module.set.marker.time(0);
          }
        },

        detach: function() {
          if (!$media) return;
          module.debug("Detached from", $media[0]);
          $media.off(mediaEventNamespace);
          $media = null;
        },

        goto: {
          nextMarker: () => {
            let media = $media[0];
            let time = module.find.nextMarkedTime(media.currentTime);
            if (!time) return false;
            media.currentTime = time;
            return true;
          },
          prevMarker: () => {
            let media = $media[0];
            let time = module.find.prevMarkedTime(media.currentTime);
            if (!time) return false;
            media.currentTime = time;
            return true;
          }
        },

        find: {
          nextMarkedTime: time => {
            time = [...$module.children(".marker")]
              .map(el => Number(el.getAttribute("data-time")))
              .sort()
              .find(t => t > time);
            return time != null ? time : null;
          },
          prevMarkedTime: time => {
            time = [...$module.children(".marker")]
              .map(el => Number(el.getAttribute("data-time")))
              .sort()
              .reverse()
              .find(t => t < time);
            return time != null ? time : null;
          }
        },

        add: {
          /**
           * Add a marker at the specified time
           * @param[Object] opts  Marker options
           *   - time [Number] time  Marker time in seconds. Ignored if not attached to a media element.
           *   - id [String] Unique element id for the marker div
           *   - class [String] Class name for the marker div
           *   - color [String] One of Semantic UI color
           *   - position [String] One of [{'bottom'}|'top'|'none'] to specify
           *                       the placement of marker icon
           *   - tooltip [String] Tooltip string
           *   - iconHTML [String|HTMLElement] to specify custom marker icon
           * @returns jQuery object containing the created marker
           */
          marker: function(opts = {}) {
            module.debug("Adding a marker:", opts);
            let $marker = $(
              '<div class="marker" data-time=0><button>' +
                (opts.iconHTML
                  ? opts.iconHTML
                  : settings.defaultMarkerIconHTML) +
                "</button></div>"
            );
            $module.append($marker);
            if (opts.id) $marker.attr("id", opts.id);
            if (opts.class) $marker.addClass(opts.class);
            if (opts.color) $marker.addClass(opts.color);
            if (opts.position) $marker.addClass(opts.position);
            if (opts.position != "top" && !opts.iconHTML)
              $marker.find("button>i").addClass("vertically flipped");
            if (opts.tooltip) {
              $marker.attr("data-tooltip", opts.tooltip);
              $marker.attr("data-variation", "tiny");
              if ($marker.hasClass("top"))
                $marker.attr("data-position", "bottom center");
            }
            if (opts.time && $media && isFinite($media[0].duration))
              module.set.marker.time($marker, opts.time);

            module.debug("Marker created:", $marker);
            settings.onMarkerAdded(Number($marker.data("time")), $marker);
            return $marker;
          }
        },
        remove: {
          marker: selector => {
            let $marker = $module.find(".marker").filter(selector);
            if ($marker.length < 1) return;

            let time = Number($marker.data("time"));

            $marker.remove();
            module.debug("Marker removed:", $marker);
            settings.onMarkerRemoved(time, $marker);
          }
        },
        get: {
          media: function() {
            return module.$media[0];
          },
          marker: {
            $: selector =>
              selector
                ? $module.find(".marker").filter(selector)
                : $module.find(".marker"),
            count: () => $module.find(".marker").length,
            time: id => {
              if (id) return _marker_id(id).data("time");
              else return $module.find(".marker").data("time");
            }
          }
        },

        set: {
          media: function(mediaValue) {
            module.attach(mediaValue);
          },
          barWidth: function(value) {
            $module.progress("set barWidth", value);
          },
          marker: {
            time: (id, time) => {
              module.debug("set marker time arguments:", id, time);
              let $marker;
              if (arguments.length > 1) {
                $marker = _marker_id(id);
              } else {
                $marker = $module.find(".marker");
              }
              let media = $media[0];
              $marker.css("left", _time2px(time) + "px");
              module.debug(
                "set marker time data to: ",
                time < 0 ? 0 : time > media.duration ? media.duration : time
              );
              $marker.attr(
                "data-time",
                time < 0 ? 0 : time > media.duration ? media.duration : time
              );
              module.debug("marker time data: ", $marker.data("time"));
            }
          }
        },

        read: {
          metadata: function() {
            var data = {
              media: $module.data(metadata.media)
            };
            if (data.media) {
              module.debug(
                "Attaching the media element specified by:",
                data.media
              );
              module.attach(data.media);
            }
          },
          settings: function() {
            if (settings.media !== undefined) {
              module.debug(
                "Attaching the media element specified by:",
                settings.media
              );
              try {
                module.attach(settings.media);
              } catch (e) {
                settings.media = null;
                module.error(e, settings.media);
              }
            }
          }
        },

        bind: {
          events: function() {
            // if (hasTouch) {
            //   module.bind.touchEvents();
            // }
            // module.bind.keyboardEvents();
            // module.bind.inputEvents();
            module.bind.mouseEvents();
          },
          touchEvents: function() {},
          keyboardEvents: function() {},
          inputEvents: function() {},
          mouseEvents: function() {
            module.verbose("Binding mouse events");
            $module
              .on("mousedown" + eventNamespace, module.event.mousedown)
              .on(
                "mousedown" + eventNamespace,
                ".marker",
                module.event.marker.mousedown
              );
            $bar
              .on("mouseenter" + eventNamespace, module.event.bar.mouseenter)
              .on("mouseleave" + eventNamespace, module.event.bar.mouseleave);
          },
          mediaEvents: () => {
            module.verbose("Binding media events");
            $media
              .on(
                "loadedmetadata" + mediaEventNamespace,
                module.event.media.loadedmetadata
              )
              .on(
                "loadeddata" + mediaEventNamespace,
                module.event.media.loadeddata
              )
              .on(
                "loadedmetadata" + mediaEventNamespace,
                module.event.media.loadedmetadata
              )
              .on("emptied" + mediaEventNamespace, module.event.media.emptied)
              .on(
                "timeupdate" + mediaEventNamespace,
                module.event.media.timeupdate
              );
          }
        },

        event: {
          media: {
            loadedmetadata: () => {
              module.debug("Attached media loaded metadata");
              $module.progress("set total", $media[0].duration);
              $module.progress("update progress", 0);
              module.set.marker.time(0);
            },
            loadeddata: () => {
              module.debug("Attached media loaded data", $module);
              $module.removeClass("disabled");
              $module.progress("update progress", $media[0].currentTime);
            },
            emptied: () => {
              module.debug("Attached media emptied data", $module);
              $module.addClass("disabled");
              $cursor.addClass("hide");
              $module.progress("update progress", 0);
            },
            timeupdate: () => {
              $module.progress("update progress", $media[0].currentTime);
            }
          },
          bar: {
            mouseenter: e => {
              $cursor.removeClass("hide");
            },
            mouseleave: e => {
              $cursor.addClass("hide");
            }
          },
          marker: {
            mousedown: e => {
              $marker = $(e.target).closest(".marker");
            }
          },
          mousedown: e => {
            if (e.originalEvent.button == 0) {
              // only for left-mouse click
              let media = $media[0];
              playing = !media.paused;
              if (playing) media.pause();
              $cursor.addClass("grabbed");
              animeDuration = $bar.css("transition-duration");
              $bar.css("transition-duration", "0s");

              $(window)
                .on("mousemove", module.event.mousemove)
                .on("mouseup", module.event.mouseup);
              module.event.mousemove(e);
            }
            e.stopPropagation();
          },

          // Window mouse event callbacks
          mousemove: e => {
            let pxToSet = e.originalEvent.pageX - _find_pos(element);
            let timeToSet = _px2time(pxToSet);
            $module.progress("update progress", timeToSet);
            $media[0].currentTime = timeToSet;

            if ($marker) {
              const oldTime = $marker.data("time");
              $marker.attr("data-time", timeToSet);
              $marker.css("left", _time2px(timeToSet) + "px");
              settings.onMarkerMove(timeToSet, oldTime, $marker);
            }
          },
          mouseup: e => {
            $(window)
              .off("mousemove", module.event.mousemove)
              .off("mouseup", module.event.mouseup);
            $cursor.removeClass("grabbed");
            $bar.css("transition-duration", animeDuration);
            if ($marker) $marker = null;
            if (playing) $media[0].play();
          }
        },

        // Semantic UI standard functions
        setting: function(name, value) {
          module.debug("Changing setting", name, value);
          let rval = $module.progress("setting", name, value);
          if (rval === undefined) {
            if ($.isPlainObject(name)) {
              $.extend(true, settings, name);
            } else if (value !== undefined) {
              if ($.isPlainObject(settings[name])) {
                $.extend(true, settings[name], value);
              } else {
                settings[name] = value;
              }
            } else {
              rval = settings[name];
            }
          }
          return rval;
        },
        internal: function(name, value) {
          if ($.isPlainObject(name)) {
            $.extend(true, module, name);
          } else if (value !== undefined) {
            module[name] = value;
          } else {
            return module[name];
          }
        },
        debug: function() {
          if (!settings.silent && settings.debug) {
            module.debug = Function.prototype.bind.call(
              console.info,
              console,
              settings.name + ":"
            );
            module.debug.apply(console, arguments);
          }
        },
        verbose: function() {
          if (!settings.silent && settings.verbose && settings.debug) {
            module.verbose = Function.prototype.bind.call(
              console.info,
              console,
              settings.name + ":"
            );
            module.verbose.apply(console, arguments);
          }
        },
        error: function() {
          if (!settings.silent) {
            module.error = Function.prototype.bind.call(
              console.error,
              console,
              settings.name + ":"
            );
            module.error.apply(console, arguments);
          }
        },
        invoke: function(query, passedArguments, context) {
          var object = instance,
            maxDepth,
            found,
            response;
          passedArguments = passedArguments || queryArguments;
          context = element || context;
          if (typeof query == "string" && object !== undefined) {
            query = query.split(/[\. ]/);
            maxDepth = query.length - 1;
            $.each(query, function(depth, value) {
              var camelCaseValue =
                depth != maxDepth
                  ? value +
                    query[depth + 1].charAt(0).toUpperCase() +
                    query[depth + 1].slice(1)
                  : query;
              if (
                $.isPlainObject(object[camelCaseValue]) &&
                depth != maxDepth
              ) {
                object = object[camelCaseValue];
              } else if (object[camelCaseValue] !== undefined) {
                found = object[camelCaseValue];
                return false;
              } else if ($.isPlainObject(object[value]) && depth != maxDepth) {
                object = object[value];
              } else if (object[value] !== undefined) {
                found = object[value];
                return false;
              } else {
                module.error(error.method, query);
                return false;
              }
            });
          }
          if ($.isFunction(found)) {
            response = found.apply(context, passedArguments);
          } else if (found !== undefined) {
            response = found;
          }
          if ($.isArray(returnedValue)) {
            returnedValue.push(response);
          } else if (returnedValue !== undefined) {
            returnedValue = [returnedValue, response];
          } else if (response !== undefined) {
            returnedValue = response;
          }
          return found;
        }
      };

      if (methodInvoked) {
        if (instance === undefined) {
          module.initialize();
        }
        module.invoke(query);
      } else {
        if (instance !== undefined) {
          instance.invoke("destroy");
        }
        module.initialize();
      }
    });

    return returnedValue !== undefined ? returnedValue : this;
  };

  $.fn.mediaProgress.settings = {
    name: "Media Progress",
    namespace: "mediaProgress",

    silent: false,
    debug: false,
    verbose: false,

    defaultMarkerIconHTML: '<i class="fitted marker icon"></i>',

    /* Callbacks */
    onMarkerMove: function(newTime, oldTime, $selected) {},
    onMarkerAdded: function(time, $marker) {},
    onMarkerRemoved: function(time, $marker) {},

    metadata: {
      media: "media"
    },

    selector: {
      bar: "> .bar",
      cursor: "> .bar > .cursor"
    }
  };
})(jQuery, window, document);
