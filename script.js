(function () {
  "use strict";

  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".site-nav a"));
  var sections = ["home", "experience", "contact"].map(function (id) {
    return document.getElementById(id);
  }).filter(Boolean);

  function setActive() {
    var y = window.scrollY + 96;
    var current = sections[0] && sections[0].id;

    sections.forEach(function (section) {
      if (section.offsetTop <= y) current = section.id;
    });

    navLinks.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      link.classList.toggle("is-active", href === "#" + current);
    });
  }

  window.addEventListener("scroll", setActive, { passive: true });
  setActive();

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );

  reveals.forEach(function (el) {
    observer.observe(el);
  });
})();
