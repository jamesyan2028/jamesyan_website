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
})();
