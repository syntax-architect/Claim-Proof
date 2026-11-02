/* SABOOT Landing Page — Billing Toggle */
function setBilling(interval) {
  var isAnnual = interval === 'annual';
  var btnM = document.getElementById('btn-monthly');
  var btnA = document.getElementById('btn-annual');
  if (btnM && btnA) {
    if (isAnnual) {
      btnA.classList.add('active');
      btnM.classList.remove('active');
    } else {
      btnM.classList.add('active');
      btnA.classList.remove('active');
    }
  }

  var prices = document.querySelectorAll('.price-val');
  var periods = document.querySelectorAll('.period-val');
  var savings = document.querySelectorAll('.savings-val');

  prices.forEach(function (el) {
    el.textContent = isAnnual ? el.getAttribute('data-annual') : el.getAttribute('data-monthly');
  });
  periods.forEach(function (el) {
    el.textContent = isAnnual ? el.getAttribute('data-annual') : el.getAttribute('data-monthly');
  });
  savings.forEach(function (el) {
    el.textContent = isAnnual ? el.getAttribute('data-annual') : el.getAttribute('data-monthly');
  });
}

document.addEventListener('DOMContentLoaded', function () {
  var btnM = document.getElementById('btn-monthly');
  var btnA = document.getElementById('btn-annual');
  if (btnM) {
    btnM.addEventListener('click', function () {
      setBilling('monthly');
    });
  }
  if (btnA) {
    btnA.addEventListener('click', function () {
      setBilling('annual');
    });
  }
});
