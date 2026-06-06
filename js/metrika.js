(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var id = parseInt(cfg.metrikaId, 10);
  if (!id || id < 1) return;

  window.ym = window.ym || function () {
    (window.ym.a = window.ym.a || []).push(arguments);
  };
  window.ym.l = Date.now();

  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://mc.yandex.ru/metrika/tag.js';
  var first = document.getElementsByTagName('script')[0];
  if (first && first.parentNode) first.parentNode.insertBefore(script, first);

  window.ym(id, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
    ecommerce: 'dataLayer'
  });

  var noscript = document.createElement('noscript');
  noscript.innerHTML = '<div><img src="https://mc.yandex.ru/watch/' + id + '" style="position:absolute;left:-9999px;" alt=""></div>';
  document.body.appendChild(noscript);
})();
