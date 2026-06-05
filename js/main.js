(function () {
  'use strict';
  const STORAGE = 'vremya_pereezd_reviews';
  const MIN_PUBLISH_RATING = 4;
  const STATUS_HIDE_MS = 6000;
  const GALLERY_PHOTOS_PER_PAGE = 6;
  const GALLERY_FALLBACK = [
    { file: 'images/gallery/work/photo-01.jpg', caption: 'Фото 1' },
    { file: 'images/gallery/work/photo-02.jpg', caption: 'Фото 2' },
    { file: 'images/gallery/work/photo-03.jpg', caption: 'Фото 3' },
    { file: 'images/gallery/work/photo-04.jpg', caption: 'Фото 4' },
    { file: 'images/gallery/work/photo-05.jpg', caption: 'Фото 5' },
    { file: 'images/gallery/work/photo-06.jpg', caption: 'Фото 6' },
    { file: 'images/gallery/work/photo-07.jpg', caption: 'Фото 7' },
    { file: 'images/gallery/work/photo-08.jpg', caption: 'Фото 8' },
    { file: 'images/gallery/work/photo-09.jpg', caption: 'Фото 9' }
  ];
  const DEFAULT_REVIEWS = [
    { id: '1', name: 'Александр', text: 'Отличная работа! Переехали быстро, всё аккуратно упаковали и перевезли. Рекомендую!', rating: 5 },
    { id: '2', name: 'Марина', text: 'Заказывали переезд квартиры — всё прошло без проблем. Грузчики вежливые.', rating: 5 },
    { id: '3', name: 'Дмитрий', text: 'Переезжали офис — справились за один день. Мебель собрали на новом месте.', rating: 5 },
    { id: '4', name: 'Елена', text: 'Очень довольна сервисом. Приехали вовремя, работали быстро и аккуратно.', rating: 5 },
    { id: '5', name: 'Игорь', text: 'Перевозили пианино — всё доставили целым. Профессионалы!', rating: 5 }
  ];

  var statusTimer = null;

  function getReviews() {
    try {
      var s = localStorage.getItem(STORAGE);
      if (s) return JSON.parse(s);
    } catch (e) {}
    localStorage.setItem(STORAGE, JSON.stringify(DEFAULT_REVIEWS));
    return DEFAULT_REVIEWS;
  }

  function saveReviews(list) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(list));
    } catch (e) {}
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

  function renderReviews() {
    var track = document.getElementById('reviewsTrack');
    if (!track) return;
    var list = getReviews();
    if (!list.length) {
      track.innerHTML = '<p class="reviews-empty">Пока нет отзывов. Будьте первым!</p>';
      return;
    }
    track.innerHTML = list.map(function (r) {
      return '<div class="review-card"><div class="review-card__stars">' + stars(r.rating) + '</div><p class="review-card__text">«' + esc(r.text) + '»</p><div class="review-card__author">' + esc(r.name) + '</div></div>';
    }).join('');
    slide = 0;
  }

  var slide = 0;

  function visible() {
    if (window.innerWidth >= 1024) return 3;
    if (window.innerWidth >= 640) return 2;
    return 1;
  }

  function move(dir) {
    var track = document.getElementById('reviewsTrack');
    if (!track) return;
    var cards = track.querySelectorAll('.review-card');
    if (!cards.length) return;
    var v = visible();
    var max = Math.max(0, cards.length - v);
    slide += dir;
    if (slide < 0) slide = max;
    if (slide > max) slide = 0;
    track.scrollTo({ left: slide * (cards[0].offsetWidth + 16), behavior: 'smooth' });
  }

  function showFormStatus(el, text, type) {
    if (!el) return;
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    el.textContent = text;
    el.className = 'review-form__status review-form__status--' + type;
    el.hidden = false;
    statusTimer = setTimeout(function () {
      el.hidden = true;
      el.textContent = '';
      statusTimer = null;
    }, STATUS_HIDE_MS);
  }

  function initStarRating() {
    var wrap = document.getElementById('starRating');
    var hidden = document.getElementById('reviewRating');
    if (!wrap || !hidden) return;

    var buttons = wrap.querySelectorAll('.star-rating__btn');

    function setRating(value) {
      hidden.value = String(value);
      buttons.forEach(function (btn) {
        var v = parseInt(btn.getAttribute('data-value'), 10);
        btn.classList.toggle('is-active', v <= value);
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setRating(parseInt(btn.getAttribute('data-value'), 10));
      });
    });

    wrap.addEventListener('mouseleave', function () {
      var current = parseInt(hidden.value, 10) || 0;
      buttons.forEach(function (btn) {
        var v = parseInt(btn.getAttribute('data-value'), 10);
        btn.classList.toggle('is-active', v <= current);
      });
    });

    buttons.forEach(function (btn) {
      btn.addEventListener('mouseenter', function () {
        var hover = parseInt(btn.getAttribute('data-value'), 10);
        buttons.forEach(function (b) {
          var v = parseInt(b.getAttribute('data-value'), 10);
          b.classList.toggle('is-active', v <= hover);
        });
      });
    });
  }

  function initReviewForm() {
    var form = document.getElementById('reviewForm');
    var statusEl = document.getElementById('reviewFormStatus');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (window.LPSecurity) {
        var check = window.LPSecurity.canSubmitReview();
        if (!check.ok) {
          if (check.reason === 'rate') {
            showFormStatus(statusEl, 'Слишком много попыток. Попробуйте позже.', 'err');
          } else if (check.reason === 'daily') {
            showFormStatus(statusEl, 'Сегодня уже отправлено несколько отзывов. Попробуйте завтра.', 'err');
          } else {
            showFormStatus(statusEl, 'Не удалось отправить. Обновите страницу и попробуйте снова.', 'err');
          }
          return;
        }
      }

      var rating = parseInt(document.getElementById('reviewRating').value, 10);
      var nameInput = document.getElementById('reviewName');
      var textInput = document.getElementById('reviewText');
      var name = nameInput && nameInput.value || '';
      var text = textInput && textInput.value || '';

      if (window.LPSecurity) {
        name = window.LPSecurity.sanitizeName(name);
        text = window.LPSecurity.sanitizeText(text);
      } else {
        name = name.trim();
        text = text.trim();
      }

      if (window.LPSecurity && (window.LPSecurity.hasSuspiciousContent(name) || window.LPSecurity.hasSuspiciousContent(text))) {
        showFormStatus(statusEl, 'Отзыв содержит недопустимые символы или ссылки.', 'err');
        return;
      }

      if (!rating || rating < 1 || rating > 5) {
        showFormStatus(statusEl, 'Выберите оценку от 1 до 5 звёзд.', 'err');
        return;
      }
      if (!name || name.length < 2) {
        showFormStatus(statusEl, 'Укажите имя (минимум 2 символа).', 'err');
        return;
      }
      if (!text || text.length < 10) {
        showFormStatus(statusEl, 'Напишите отзыв подробнее (минимум 10 символов).', 'err');
        return;
      }

      if (window.LPSecurity) window.LPSecurity.recordReviewSubmit();

      if (rating >= MIN_PUBLISH_RATING) {
        var list = getReviews();
        list.unshift({
          id: 'u-' + Date.now(),
          name: name,
          text: text,
          rating: rating
        });
        saveReviews(list);
        renderReviews();
        showFormStatus(statusEl, 'Спасибо! Ваш отзыв опубликован на сайте.', 'ok');
      } else {
        showFormStatus(
          statusEl,
          'Отзыв отправлен модератору на проверку. На сайте он не отображается до одобрения.',
          'mod'
        );
      }

      form.reset();
      document.getElementById('reviewRating').value = '0';
      document.querySelectorAll('.star-rating__btn').forEach(function (b) {
        b.classList.remove('is-active');
      });
    });
  }

  function initHeroCarousel() {
    var carousel = document.getElementById('heroCarousel');
    if (!carousel) return;
    var slides = carousel.querySelectorAll('.hero__slide');
    if (slides.length < 2) return;

    var index = 0;
    var timer = null;
    var interval = 20000;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function show(next) {
      slides[index].classList.remove('is-active');
      index = (next + slides.length) % slides.length;
      slides[index].classList.add('is-active');
    }

    function restartTimer() {
      if (timer) clearInterval(timer);
      if (reducedMotion) return;
      timer = setInterval(function () { show(index + 1); }, interval);
    }

    var prevBtn = document.getElementById('heroPrev');
    var nextBtn = document.getElementById('heroNext');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        show(index - 1);
        restartTimer();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        show(index + 1);
        restartTimer();
      });
    }

    restartTimer();
  }

  function escAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function loadGalleryData() {
    return fetch('data/gallery.json?_=' + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error('gallery');
        return res.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.photos) || !data.photos.length) {
          return GALLERY_FALLBACK;
        }
        return data.photos.map(function (photo) {
          return {
            file: photo.file,
            caption: photo.caption || 'Фото'
          };
        });
      })
      .catch(function () {
        return GALLERY_FALLBACK.slice();
      });
  }

  function renderGalleryTrack(photos) {
    var track = document.getElementById('galleryTrack');
    if (!track) return;

    if (!photos.length) {
      track.innerHTML = '<p class="reviews-empty">Фото скоро появятся</p>';
      return;
    }

    var pages = [];
    for (var i = 0; i < photos.length; i += GALLERY_PHOTOS_PER_PAGE) {
      pages.push(photos.slice(i, i + GALLERY_PHOTOS_PER_PAGE));
    }

    track.innerHTML = pages.map(function (pagePhotos) {
      var items = pagePhotos.map(function (photo) {
        var caption = photo.caption || 'Фото';
        return '<button type="button" class="photo-gallery__item" data-caption="' + escAttr(caption) + '">' +
          '<img src="' + escAttr(photo.file) + '" alt="' + escAttr(caption) + '" loading="lazy" decoding="async">' +
          '</button>';
      }).join('');
      return '<div class="gallery-carousel__page"><div class="photo-gallery__grid">' + items + '</div></div>';
    }).join('');
  }

  var galleryPage = 0;
  var galleryCarouselReady = false;

  function updateGalleryCarousel() {
    var track = document.getElementById('galleryTrack');
    var prevBtn = document.getElementById('galleryPrev');
    var nextBtn = document.getElementById('galleryNext');
    if (!track) return;

    var pages = track.querySelectorAll('.gallery-carousel__page');
    if (!pages.length) {
      track.style.transform = 'translateX(0)';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    if (galleryPage >= pages.length) galleryPage = 0;
    track.style.transform = 'translateX(-' + (galleryPage * 100) + '%)';
    if (prevBtn) prevBtn.disabled = galleryPage === 0;
    if (nextBtn) nextBtn.disabled = galleryPage >= pages.length - 1;
  }

  function initGalleryCarousel() {
    if (!galleryCarouselReady) {
      galleryCarouselReady = true;
      var prevBtn = document.getElementById('galleryPrev');
      var nextBtn = document.getElementById('galleryNext');
      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          if (galleryPage > 0) {
            galleryPage -= 1;
            updateGalleryCarousel();
          }
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          var track = document.getElementById('galleryTrack');
          if (!track) return;
          var pages = track.querySelectorAll('.gallery-carousel__page');
          if (galleryPage < pages.length - 1) {
            galleryPage += 1;
            updateGalleryCarousel();
          }
        });
      }
    }
    galleryPage = 0;
    updateGalleryCarousel();
  }

  function initGallery() {
    var lightbox = document.getElementById('galleryLightbox');
    var lightboxImg = document.getElementById('galleryLightboxImg');
    var track = document.getElementById('galleryTrack');
    if (!lightbox || !lightboxImg || !track) return;

    var backdrop = lightbox.querySelector('.gallery-lightbox__backdrop');
    var closeBtn = lightbox.querySelector('.gallery-lightbox__close');

    function closeLightbox() {
      lightbox.hidden = true;
      lightboxImg.removeAttribute('src');
      document.body.classList.remove('gallery-open');
    }

    track.addEventListener('click', function (e) {
      var btn = e.target.closest('.photo-gallery__item');
      if (!btn) return;
      var img = btn.querySelector('img');
      if (!img) return;
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt || btn.getAttribute('data-caption') || '';
      lightbox.hidden = false;
      document.body.classList.add('gallery-open');
    });

    if (backdrop) backdrop.addEventListener('click', closeLightbox);
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
    });
  }

  function initDynamicGallery() {
    initGallery();
    loadGalleryData().then(function (photos) {
      renderGalleryTrack(photos);
      initGalleryCarousel();
    });
  }

  function initBurger() {
    var burger = document.getElementById('burger');
    var nav = document.getElementById('nav');
    var backdrop = document.getElementById('navBackdrop');
    if (!burger || !nav) return;
    function setMenuOpen(open) {
      nav.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('menu-open', open);
      if (backdrop) backdrop.hidden = !open;
    }
    burger.addEventListener('click', function () { setMenuOpen(!nav.classList.contains('open')); });
    if (backdrop) backdrop.addEventListener('click', function () { setMenuOpen(false); });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setMenuOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) setMenuOpen(false);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderReviews();
    initStarRating();
    initReviewForm();
    var prev = document.getElementById('reviewsPrev');
    var next = document.getElementById('reviewsNext');
    if (prev) prev.addEventListener('click', function () { move(-1); });
    if (next) next.addEventListener('click', function () { move(1); });
    window.addEventListener('resize', function () { slide = 0; });
    initBurger();
    initHeroCarousel();
    initDynamicGallery();
  });
})();
