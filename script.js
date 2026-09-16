(function () {
  "use strict";

  /* ---------------------------------------------------------
     Config
  --------------------------------------------------------- */
  var FRAME_COUNT = 933;
  var PX_PER_FRAME_DESKTOP = 16; // scroll distance (px) per frame on desktop
  var PX_PER_FRAME_MOBILE = 7;   // lower = faster scrub through the video
  var PX_PER_FRAME = PX_PER_FRAME_DESKTOP;
  var FRAME_PATH = function (i) {
    return "frames/frame_" + String(i).padStart(3, "0") + ".webp";
  };

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
      el: document.querySelector('.bubble--' + cfg.key)
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
    var scrubDistance = (FRAME_COUNT - 1) * PX_PER_FRAME;
    spacer.style.height = (scrubDistance + window.innerHeight) + "px";
  }

  sizeCanvas();
  sizeSpacer();

  /* ---------------------------------------------------------
     Preload frames
  --------------------------------------------------------- */
  var images = new Array(FRAME_COUNT);
  var loadedCount = 0;
  var ready = false;

  function drawFrame(idx) {
    idx = Math.max(0, Math.min(FRAME_COUNT - 1, idx));
    var img = images[idx];
    if (!img || !img.complete || !img.naturalWidth) return;

    var cw = canvas.width;
    var ch = canvas.height;
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    var scale = Math.max(cw / iw, ch / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = (cw - dw) / 2;
    var dy = (ch - dh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function onFrameSettled() {
    loadedCount++;
    var pct = Math.round((loadedCount / FRAME_COUNT) * 100);
    loaderFill.style.width = pct + "%";
    loaderPct.textContent = pct;
    if (loadedCount >= FRAME_COUNT) {
      finishLoading();
    }
  }

  function preload() {
    for (var i = 0; i < FRAME_COUNT; i++) {
      var img = new Image();
      img.decoding = "async";
      img.onload = onFrameSettled;
      img.onerror = onFrameSettled;
      img.src = FRAME_PATH(i + 1);
      images[i] = img;
    }
  }

  function finishLoading() {
    if (ready) return;
    ready = true;
    drawFrame(0);
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
      var opacity = 0;
      if (p < b.start) {
        opacity = 0;
      } else if (p < b.fadeIn) {
        opacity = (p - b.start) / (b.fadeIn - b.start);
      } else if (p < b.fadeOut) {
        opacity = 1;
      } else if (p < b.end) {
        opacity = 1 - (p - b.fadeOut) / (b.end - b.fadeOut);
      } else {
        opacity = 0;
      }
      opacity = Math.max(0, Math.min(1, opacity));

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
    var frameIdx = Math.round(p * (FRAME_COUNT - 1));
    drawFrame(frameIdx);
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

  preload();
})();
