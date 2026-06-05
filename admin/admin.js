(function () {
  'use strict';

  var csrf = '';
  var photos = [];

  var loginScreen = document.getElementById('loginScreen');
  var panelScreen = document.getElementById('panelScreen');
  var loginForm = document.getElementById('loginForm');
  var loginError = document.getElementById('loginError');
  var loginNotice = document.getElementById('loginNotice');
  var logoutBtn = document.getElementById('logoutBtn');
  var uploadForm = document.getElementById('uploadForm');
  var uploadInput = document.getElementById('uploadInput');
  var uploadPickBtn = document.getElementById('uploadPickBtn');
  var uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
  var uploadStatus = document.getElementById('uploadStatus');
  var photoGrid = document.getElementById('photoGrid');
  var photoCount = document.getElementById('photoCount');
  var emptyState = document.getElementById('emptyState');
  var tpl = document.getElementById('photoCardTpl');

  function apiUrl(action) {
    return 'api.php?action=' + encodeURIComponent(action);
  }

  function showMsg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
    el.className = 'admin-msg' + (type ? ' admin-msg--' + type : '');
  }

  function setView(loggedIn) {
    loginScreen.hidden = loggedIn;
    panelScreen.hidden = !loggedIn;
  }

  function fetchJson(url, options) {
    options = options || {};
    options.credentials = 'same-origin';
    return fetch(url, options).then(function (res) {
      return res.text().then(function (text) {
        var data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          throw { error: 'server', status: res.status };
        }
        if (!res.ok) throw data;
        return data;
      });
    });
  }

  function checkServer() {
    if (!loginNotice) return Promise.resolve(false);
    showMsg(loginNotice, 'Проверка сервера…', '');
    return fetchJson(apiUrl('ping')).then(function (data) {
      if (!data.writable || (!data.writable.data && !data.writable.gallery)) {
        showMsg(
          loginNotice,
          'PHP работает, но папки data/ или images/gallery/work/ недоступны для записи. Выставьте права 755 или 775 на хостинге.',
          'err'
        );
        return true;
      }
      showMsg(loginNotice, 'Сервер готов. Введите пароль.', 'ok');
      return true;
    }).catch(function () {
      showMsg(
        loginNotice,
        'PHP на хостинге не отвечает. Админка работает только на сайте с PHP, не с локального файла на компьютере.',
        'err'
      );
      return false;
    });
  }

  function loadSession() {
    return checkServer().then(function (serverOk) {
      if (!serverOk) {
        setView(false);
        return null;
      }
      return fetchJson(apiUrl('session'));
    }).then(function (data) {
      if (!data) return;
      if (data.loggedIn) {
        csrf = data.csrf || '';
        setView(true);
        return loadPhotos();
      }
      setView(false);
    }).catch(function () {
      setView(false);
    });
  }

  function loadPhotos() {
    return fetchJson(apiUrl('list')).then(function (data) {
      csrf = data.csrf || csrf;
      photos = data.photos || [];
      renderPhotos();
    });
  }

  function renderPhotos() {
    photoGrid.innerHTML = '';
    photoCount.textContent = String(photos.length);
    emptyState.hidden = photos.length > 0;

    photos.forEach(function (photo, index) {
      var node = tpl.content.firstElementChild.cloneNode(true);
      var img = node.querySelector('.admin-card__img');
      var captionInput = node.querySelector('.admin-card__caption');
      var replaceInput = node.querySelector('.admin-btn--file input');

      img.src = '../' + photo.file + '?v=' + encodeURIComponent(photo.id);
      img.alt = photo.caption || '';
      captionInput.value = photo.caption || '';
      node.dataset.id = photo.id;

      captionInput.addEventListener('change', function () {
        updateCaption(photo.id, captionInput.value.trim());
      });

      node.querySelector('[data-action="delete"]').addEventListener('click', function () {
        if (!window.confirm('Удалить это фото с сайта?')) return;
        deletePhoto(photo.id);
      });

      node.querySelector('[data-action="left"]').addEventListener('click', function () {
        if (index > 0) movePhoto(index, index - 1);
      });

      node.querySelector('[data-action="right"]').addEventListener('click', function () {
        if (index < photos.length - 1) movePhoto(index, index + 1);
      });

      replaceInput.addEventListener('change', function () {
        if (!replaceInput.files || !replaceInput.files[0]) return;
        replacePhoto(photo.id, replaceInput.files[0]);
        replaceInput.value = '';
      });

      photoGrid.appendChild(node);
    });
  }

  function movePhoto(from, to) {
    var next = photos.slice();
    var item = next.splice(from, 1)[0];
    next.splice(to, 0, item);
    reorderPhotos(next.map(function (p) { return p.id; }));
  }

  function reorderPhotos(order) {
    fetchJson(apiUrl('reorder'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf: csrf, order: order })
    }).then(function (data) {
      csrf = data.csrf || csrf;
      photos = data.photos || [];
      renderPhotos();
    }).catch(handleError);
  }

  function deletePhoto(id) {
    fetchJson(apiUrl('delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf: csrf, id: id })
    }).then(function (data) {
      csrf = data.csrf || csrf;
      photos = data.photos || [];
      renderPhotos();
    }).catch(handleError);
  }

  function updateCaption(id, caption) {
    if (!caption) return;
    fetchJson(apiUrl('caption'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf: csrf, id: id, caption: caption })
    }).then(function (data) {
      csrf = data.csrf || csrf;
      photos = data.photos || [];
    }).catch(handleError);
  }

  function replacePhoto(id, file) {
    var fd = new FormData();
    fd.append('csrf', csrf);
    fd.append('id', id);
    fd.append('photo', file);

    fetchJson(apiUrl('replace'), { method: 'POST', body: fd })
      .then(function (data) {
        csrf = data.csrf || csrf;
        photos = data.photos || [];
        renderPhotos();
        showMsg(uploadStatus, 'Фото заменено.', 'ok');
      })
      .catch(handleError);
  }

  function handleError(err) {
    var msg = 'Ошибка. Попробуйте снова.';
    var loginMsg = msg;

    if (err && err.error === 'auth') loginMsg = 'Сессия истекла. Войдите снова.';
    if (err && err.error === 'locked') loginMsg = 'Слишком много попыток. Подождите 15 минут.';
    if (err && err.error === 'password') loginMsg = 'Неверный пароль. Проверьте раскладку клавиатуры (русские буквы).';
    if (err && err.error === 'server') loginMsg = 'Сервер PHP не отвечает. Зайдите через адрес сайта на хостинге: ваш-домен.ru/admin/';
    if (err && err.error === 'upload') msg = 'Не удалось загрузить файл.';
    if (err && err.error === 'size') msg = 'Файл слишком большой (макс. 8 МБ).';
    if (err && err.error === 'type') msg = 'Поддерживаются только JPG, PNG и WEBP.';

    if (err && (err.error === 'password' || err.error === 'locked' || err.error === 'server' || err.error === 'auth')) {
      showMsg(loginError, loginMsg, 'err');
    }
    if (err && err.error !== 'password' && err.error !== 'locked' && err.error !== 'server' && err.error !== 'auth') {
      showMsg(uploadStatus, msg, 'err');
    }
    if (err && err.error === 'auth') {
      csrf = '';
      setView(false);
    }
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    showMsg(loginError, '', '');
    var password = document.getElementById('loginPassword').value;
    fetchJson(apiUrl('login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    }).then(function (data) {
      csrf = data.csrf || '';
      loginForm.reset();
      setView(true);
      return loadPhotos();
    }).catch(handleError);
  });

  logoutBtn.addEventListener('click', function () {
    fetch(apiUrl('logout')).finally(function () {
      csrf = '';
      photos = [];
      setView(false);
    });
  });

  uploadPickBtn.addEventListener('click', function () {
    uploadInput.click();
  });

  uploadInput.addEventListener('change', function () {
    uploadSubmitBtn.disabled = !uploadInput.files || uploadInput.files.length === 0;
    showMsg(uploadStatus, uploadInput.files.length ? 'Выбрано файлов: ' + uploadInput.files.length : '', '');
  });

  uploadForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!uploadInput.files || !uploadInput.files.length) return;

    var fd = new FormData();
    fd.append('csrf', csrf);
    for (var i = 0; i < uploadInput.files.length; i += 1) {
      fd.append('photos[]', uploadInput.files[i]);
    }

    uploadSubmitBtn.disabled = true;
    showMsg(uploadStatus, 'Загрузка…', '');

    fetchJson(apiUrl('upload'), { method: 'POST', body: fd })
      .then(function (data) {
        csrf = data.csrf || csrf;
        photos = data.photos || [];
        uploadInput.value = '';
        uploadSubmitBtn.disabled = true;
        renderPhotos();
        showMsg(uploadStatus, 'Загружено: ' + (data.added ? data.added.length : 0), 'ok');
      })
      .catch(handleError)
      .finally(function () {
        uploadSubmitBtn.disabled = !uploadInput.files || uploadInput.files.length === 0;
      });
  });

  loadSession();
})();
