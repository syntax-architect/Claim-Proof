(function () {
  var el = document.getElementById('requested-path');
  if (el) {
    var full = window.location.pathname + window.location.search + window.location.hash;
    el.textContent = full || '/';
  }
})();
