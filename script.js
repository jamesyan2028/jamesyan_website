(function () {
  "use strict";

  /* ---------------------------------------------------------
     Config
  --------------------------------------------------------- */
  var HIGH_FRAME_COUNT = 600; // experiment: testframes (was 933 in frames/)
  var PX_PER_FRAME_DESKTOP = 24; // +50% vs prior 16 — fewer frames, longer scrub
  var PX_PER_FRAME_MOBILE = 11;  // +50% vs prior 7
  var PX_PER_FRAME = PX_PER_FRAME_DESKTOP;
  var FRAME_COUNT = HIGH_FRAME_COUNT;
  var VIDEO_TIMEOUT_MS = 6000; // if video isn't ready by then, show static image
  var mode = "high"; // "high" | "static"
  var STATIC_PATHS = [
    "image1final.png"
  ];

  function framePath(i) {
    return "testframes/frame_" + String(i).padStart(3, "0") + ".webp";
  }

  function isMobileLayout() {
    return window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
  }

  function updateScrollSpeed() {
    var base = isMobileLayout() ? PX_PER_FRAME_MOBILE : PX_PER_FRAME_DESKTOP;
    // Static mode: 75% of video scrub length (was 50%; +50% more time on page)
    PX_PER_FRAME = mode === "static" ? base * 0.75 : base;
  }

  // Where each bubble lives along total scroll progress (0..1).
  // start -> fadeIn -> (held at full opacity) -> fadeOut -> end
  var BUBBLES_CONFIG = [
    { key: "intro", start: 0.0, fadeIn: 0.0, fadeOut: 0.02, end: 0.07 },
    { key: "work", start: 0.4, fadeIn: 0.45, fadeOut: 0.62, end: 0.70 },
    { key: "contact", start: 0.86, fadeIn: 0.92, fadeOut: 1.05, end: 1.08 }
  ];

  function bubbleOpacity(cfg, p) {
    var opacity = 0;
    if (p < cfg.start) {
      opacity = 0;
    } else if (p < cfg.fadeIn) {
      opacity = (p - cfg.start) / (cfg.fadeIn - cfg.start || 1);
    } else if (p < cfg.fadeOut) {
      opacity = 1;
    } else if (p < cfg.end) {
      opacity = 1 - (p - cfg.fadeOut) / (cfg.end - cfg.fadeOut || 1);
    } else {
      opacity = 0;
    }
    return Math.max(0, Math.min(1, opacity));
  }

  /* ---------------------------------------------------------
     Elements
  --------------------------------------------------------- */
  var canvas = document.getElementById("bg");
  var ctx = canvas.getContext("2d");
  var spacer = document.getElementById("spacer");
  var loader = document.getElementById("loader");
  var loaderFill = document.getElementById("loaderFill");
  var loaderPct = document.getElementById("loaderPct");
  var scrollCue = document.getElementById("scrollCue");
  var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav-item"));

  var bubbles = BUBBLES_CONFIG.map(function (cfg) {
    return Object.assign({}, cfg, {
      el: document.querySelector(".bubble--" + cfg.key)
    });
  });

  /* ---------------------------------------------------------
     Sizing
  --------------------------------------------------------- */
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function sizeCanvas() {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }

  function sizeSpacer() {
    updateScrollSpeed();
    // Always use high-res scrub length so section timing stays consistent
    var scrubDistance = (HIGH_FRAME_COUNT - 1) * PX_PER_FRAME;
    spacer.style.height = (scrubDistance + window.innerHeight) + "px";
  }

  sizeCanvas();
  sizeSpacer();

  /* ---------------------------------------------------------
     Preload / draw
  --------------------------------------------------------- */
  var images = [];
  var staticImages = [];
  var loadedCount = 0;
  var ready = false;
  var videoAbandoned = false;

  function drawCoverImage(img, alpha) {
    if (!img || !img.complete || !img.naturalWidth || alpha <= 0) return;

    var cw = canvas.width;
    var ch = canvas.height;
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    var scale = Math.max(cw / iw, ch / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = (cw - dw) / 2;
    var dy = (ch - dh) / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function drawVideoFrame(idx) {
    idx = Math.max(0, Math.min(FRAME_COUNT - 1, idx));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCoverImage(images[idx], 1);
  }

  function drawStaticBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCoverImage(staticImages[0], 1);
  }

  function buildFramePaths() {
    var paths = [];
    for (var i = 1; i <= HIGH_FRAME_COUNT; i++) {
      paths.push(framePath(i));
    }
    return paths;
  }

  function startStaticImageLoad() {
    staticImages = [null];
    var img = new Image();
    img.decoding = "async";
    img.onload = function () {
      staticImages[0] = img;
    };
    img.onerror = function () {
      staticImages[0] = img;
    };
    img.src = STATIC_PATHS[0];
    staticImages[0] = img;
  }

  function abandonVideoDownloads() {
    videoAbandoned = true;
    for (var i = 0; i < images.length; i++) {
      if (images[i]) {
        images[i].onload = null;
        images[i].onerror = null;
        images[i].src = "";
      }
    }
    images = [];
  }

  function fallBackToStatic() {
    if (ready) return;
    mode = "static";
    abandonVideoDownloads();
    sizeSpacer(); // shorter page — faster scroll through sections

    function show() {
      if (ready) return;
      finishLoading();
    }

    if (staticImages[0] && staticImages[0].complete) {
      show();
    } else {
      var img = staticImages[0] || new Image();
      img.onload = show;
      img.onerror = show;
      if (!img.src) {
        img.src = STATIC_PATHS[0];
        staticImages[0] = img;
      }
    }
  }

  /*
    Always load the static image and video frames together.
    - If all frames finish within 8s → show video scrub
    - Otherwise → show the static image and cancel remaining video downloads
  */
  function startParallelLoad() {
    startStaticImageLoad();

    mode = "high";
    FRAME_COUNT = HIGH_FRAME_COUNT;
    images = new Array(HIGH_FRAME_COUNT);
    loadedCount = 0;
    videoAbandoned = false;

    var timer = setTimeout(function () {
      if (ready) return;
      fallBackToStatic();
    }, VIDEO_TIMEOUT_MS);

    var paths = buildFramePaths();
    for (var i = 0; i < paths.length; i++) {
      (function (idx) {
        var img = new Image();
        img.decoding = "async";
        function settled() {
          if (videoAbandoned || ready) return;
          loadedCount++;
          var pct = Math.round((loadedCount / HIGH_FRAME_COUNT) * 100);
          if (loaderFill) loaderFill.style.width = pct + "%";
          if (loaderPct) loaderPct.textContent = String(pct);

          if (loadedCount < HIGH_FRAME_COUNT) return;

          clearTimeout(timer);
          mode = "high";
          finishLoading();
        }
        img.onload = settled;
        img.onerror = settled;
        img.src = paths[idx];
        images[idx] = img;
      })(i);
    }
  }

  function finishLoading() {
    if (ready) return;
    ready = true;
    document.body.classList.add("ready");
    loader.classList.add("loader--done");
    setTimeout(function () {
      if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    }, 800);
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
  }

  /* ---------------------------------------------------------
     Scroll-driven update
  --------------------------------------------------------- */
  var ticking = false;

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }

  function getProgress() {
    var doc = document.documentElement;
    var maxScroll = doc.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return 0;
    var p = window.scrollY / maxScroll;
    return Math.max(0, Math.min(1, p));
  }

  function updateBubbles(p) {
    var activeIndex = -1;

    bubbles.forEach(function (b, i) {
      var opacity = bubbleOpacity(b, p);

      if (b.el) {
        b.el.style.opacity = opacity.toFixed(3);
        var rise = (1 - opacity) * 14;
        b.el.style.transform = "translate(-50%, calc(-50% + " + rise + "px))";
        b.el.style.pointerEvents = opacity > 0.45 ? "auto" : "none";
      }

      if (opacity > 0.5) activeIndex = i;
    });

    navItems.forEach(function (item, i) {
      item.classList.toggle("active", i === activeIndex);
    });
  }

  function update() {
    var p = getProgress();

    if (mode === "static") {
      drawStaticBackground();
    } else {
      var frameIdx = Math.round(p * (FRAME_COUNT - 1));
      drawVideoFrame(frameIdx);
    }

    updateBubbles(p);

    if (scrollCue) {
      scrollCue.classList.toggle("scroll-cue--hidden", p > 0.03);
    }

    ticking = false;
  }

  /* ---------------------------------------------------------
     Nav — click to jump to a section
  --------------------------------------------------------- */
  navItems.forEach(function (item, i) {
    item.addEventListener("click", function () {
      var cfg = BUBBLES_CONFIG[i];
      if (!cfg) return;
      var mid = (cfg.fadeIn + cfg.fadeOut) / 2;
      var doc = document.documentElement;
      var maxScroll = doc.scrollHeight - window.innerHeight;
      window.scrollTo({ top: mid * maxScroll, behavior: "smooth" });
    });
  });

  /* ---------------------------------------------------------
     Resize
  --------------------------------------------------------- */
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeCanvas();
      sizeSpacer();
      if (ready) update();
    }, 120);
  });

  sizeSpacer();
  startParallelLoad();
})();
