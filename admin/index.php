<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Админ — Фотогалерея</title>
  <link rel="stylesheet" href="admin.css">
</head>
<body>
  <div class="admin" id="adminApp">
    <section class="admin-login" id="loginScreen">
      <div class="admin-login__card">
        <h1>Админ-панель</h1>
        <p class="admin-login__lead">Управление фотогалереей «Время переезда 124»</p>
        <p class="admin-msg" id="loginNotice">Проверка сервера…</p>
        <form id="loginForm" class="admin-login__form">
          <label class="admin-field">
            <span>Пароль</span>
            <input type="password" id="loginPassword" autocomplete="current-password" required>
          </label>
          <button type="submit" class="admin-btn admin-btn--primary">Войти</button>
          <p class="admin-msg admin-msg--err" id="loginError" hidden></p>
        </form>
        <a class="admin-back" href="../index.html">← На сайт</a>
      </div>
    </section>

    <section class="admin-panel" id="panelScreen" hidden>
      <header class="admin-header">
        <div>
          <h1>Фотогалерея</h1>
          <p>Добавляйте, заменяйте и удаляйте фото на сайте</p>
        </div>
        <div class="admin-header__actions">
          <a class="admin-btn admin-btn--ghost" href="../index.html" target="_blank" rel="noopener">Открыть сайт</a>
          <button type="button" class="admin-btn admin-btn--ghost" id="logoutBtn">Выйти</button>
        </div>
      </header>

      <section class="admin-upload">
        <h2>Добавить фото</h2>
        <p class="admin-upload__hint">JPG, PNG или WEBP · до 8 МБ · автоматическое сжатие</p>
        <form id="uploadForm" class="admin-upload__form">
          <input type="file" id="uploadInput" accept="image/jpeg,image/png,image/webp" multiple hidden>
          <button type="button" class="admin-btn admin-btn--primary" id="uploadPickBtn">Выбрать файлы</button>
          <button type="submit" class="admin-btn" id="uploadSubmitBtn" disabled>Загрузить</button>
        </form>
        <p class="admin-msg" id="uploadStatus" hidden></p>
      </section>

      <section class="admin-gallery">
        <div class="admin-gallery__head">
          <h2>Фото на сайте</h2>
          <span class="admin-gallery__count" id="photoCount">0</span>
        </div>
        <div class="admin-grid" id="photoGrid"></div>
        <p class="admin-empty" id="emptyState" hidden>Пока нет фото. Загрузите первые изображения.</p>
      </section>
    </section>
  </div>

  <template id="photoCardTpl">
    <article class="admin-card">
      <div class="admin-card__img-wrap">
        <img class="admin-card__img" alt="">
      </div>
      <label class="admin-field admin-field--compact">
        <span>Подпись</span>
        <input type="text" class="admin-card__caption" maxlength="120">
      </label>
      <div class="admin-card__actions">
        <button type="button" class="admin-btn admin-btn--sm" data-action="left" title="Влево">←</button>
        <button type="button" class="admin-btn admin-btn--sm" data-action="right" title="Вправо">→</button>
        <label class="admin-btn admin-btn--sm admin-btn--file">
          Заменить
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden>
        </label>
        <button type="button" class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete">Удалить</button>
      </div>
    </article>
  </template>

  <script src="admin.js"></script>
</body>
</html>
