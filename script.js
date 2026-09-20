(function () {
  "use strict";

  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".site-nav a"));
  var sections = ["home", "experience", "contact"].map(function (id) {
    return document.getElementById(id);
  }).filter(Boolean);

  function setActive() {
    if (!sections.length) return;

    var scrollBottom = window.scrollY + window.innerHeight;
    var docHeight = document.documentElement.scrollHeight;
    var current = sections[0].id;

    // Last section is often shorter than the viewport — treat near-bottom as Contact.
    if (scrollBottom >= docHeight - 80) {
      current = sections[sections.length - 1].id;
    } else {
      var y = window.scrollY + Math.min(120, window.innerHeight * 0.35);
      sections.forEach(function (section) {
        if (section.offsetTop <= y) current = section.id;
      });
    }

    navLinks.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      link.classList.toggle("is-active", href === "#" + current);
    });
  }

  window.addEventListener("scroll", setActive, { passive: true });
  window.addEventListener("resize", setActive, { passive: true });
  window.addEventListener("hashchange", setActive);
  setActive();

  navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      // Clear sticky mobile hover highlight; scroll handler will set is-active.
      link.blur();
      window.setTimeout(setActive, 350);
    });
  });

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
