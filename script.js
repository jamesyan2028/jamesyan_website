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
  var VIDEO_TIMEOUT_MS = 10000; // if video isn't ready by then, show static and keep loading
  var mode = "high"; // "high" | "static"
  var STATIC_PATHS = [
    "image1final.png"
  ];

  function framePath(i) {
    return "testframes/frame_" + String(i).padStart(3, "0") + ".webp";
  }

  /*
    Connection strategy:
    - Extremely fast / 5G-class → try video; if not ready in 10s, fall back to static and stop
    - 4G or slower → static image only (no video download)
    Note: browsers usually report 5G as effectiveType "4g"; we use downlink >= 10 Mbps as 5G-class.
  */
  function getConnectionHint() {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return null;

    if (conn.saveData) return "static";
    if (conn.effectiveType === "5g") return "video";
    if (conn.effectiveType === "4g" && conn.downlink >= 10) return "video";
    if (conn.effectiveType === "4g") return "static";
    if (conn.effectiveType) return "static"; // 3g, 2g, slow-2g
    return null;
  }

  function measureSpeed() {
    var start = performance.now();
    return fetch("favicon.png", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("probe failed");
        return res.blob();
      })
      .then(function () {
        var ms = performance.now() - start;
        return ms < 100 ? "video" : "static";
      })
      .catch(function () {
        return "static";
      });
  }

  function decideMode() {
    var hint = getConnectionHint();
    if (hint) return Promise.resolve(hint);
    return measureSpeed();
  }

  function isMobileLayout() {
    return window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
  }

  function updateScrollSpeed() {
    PX_PER_FRAME = isMobileLayout() ? PX_PER_FRAME_MOBILE : PX_PER_FRAME_DESKTOP;
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
  var loadTotal = 0;
  var loadedCount = 0;
  var ready = false;
  var upgrading = false;
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

  function onAssetSettled() {
    loadedCount++;
    var pct = Math.round((loadedCount / loadTotal) * 100);
    if (loaderFill) loaderFill.style.width = pct + "%";
    if (loaderPct) loaderPct.textContent = String(pct);
    if (loadedCount >= loadTotal) {
      finishLoading();
    }
  }

  function preloadList(paths, targetArray, onDone) {
    loadTotal = paths.length;
    loadedCount = 0;
    var settledHandler = onDone || onAssetSettled;
    for (var i = 0; i < paths.length; i++) {
      var img = new Image();
      img.decoding = "async";
      img.onload = settledHandler;
      img.onerror = settledHandler;
      img.src = paths[i];
      targetArray[i] = img;
    }
  }

  function buildFramePaths() {
    var paths = [];
    for (var i = 1; i <= HIGH_FRAME_COUNT; i++) {
      paths.push(framePath(i));
    }
    return paths;
  }

  function ensureStaticImage(cb) {
    if (staticImages[0] && staticImages[0].complete && staticImages[0].naturalWidth) {
      cb();
      return;
    }
    var img = new Image();
    img.decoding = "async";
    img.onload = function () {
      staticImages[0] = img;
      cb();
    };
    img.onerror = function () {
      staticImages[0] = img;
      cb();
    };
    img.src = STATIC_PATHS[0];
    staticImages[0] = img;
  }

  function fallBackToStatic() {
    if (ready) return;
    mode = "static";
    videoAbandoned = true;
    upgrading = false;
    // Drop in-flight video requests so we stop burning bandwidth
    for (var i = 0; i < images.length; i++) {
      if (images[i]) {
        images[i].onload = null;
        images[i].onerror = null;
        images[i].src = "";
      }
    }
    images = [];
    ensureStaticImage(function () {
      finishLoading();
    });
  }

  /* Extremely fast only: try video; if it takes > 10s, give up and stay on static */
  function startVideoFirst() {
    mode = "high";
    FRAME_COUNT = HIGH_FRAME_COUNT;
    images = new Array(HIGH_FRAME_COUNT);
    videoAbandoned = false;
    upgrading = true;

    var timer = setTimeout(function () {
      if (ready) return;
      fallBackToStatic();
    }, VIDEO_TIMEOUT_MS);

    preloadList(buildFramePaths(), images, function () {
      loadedCount++;
      if (videoAbandoned) return;

      var pct = Math.round((loadedCount / HIGH_FRAME_COUNT) * 100);
      if (loaderFill) loaderFill.style.width = pct + "%";
      if (loaderPct) loaderPct.textContent = String(pct);

      if (loadedCount < HIGH_FRAME_COUNT) return;

      clearTimeout(timer);
      upgrading = false;

      if (!ready) {
        mode = "high";
        finishLoading();
      }
    });
  }

  /* Not extremely fast: static image only — do not load video */
  function startStaticFirst() {
    mode = "static";
    staticImages = new Array(STATIC_PATHS.length);
    preloadList(STATIC_PATHS, staticImages);
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

  decideMode().then(function (chosen) {
    sizeSpacer();
    if (chosen === "video") {
      startVideoFirst();
    } else {
      startStaticFirst();
    }
  });
})();
