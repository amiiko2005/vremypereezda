<?php
declare(strict_types=1);

require_once __DIR__ . '/lib.php';

startAdminSession();

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'ping') {
    $galleryDir = GALLERY_DIR;
    $dataDir = dirname(GALLERY_JSON);
    jsonResponse([
        'ok' => true,
        'php' => true,
        'writable' => [
            'data' => is_dir($dataDir) && is_writable($dataDir),
            'gallery' => is_dir($galleryDir) && is_writable($galleryDir),
        ],
    ]);
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (loginAttemptsBlocked()) {
        jsonResponse(['ok' => false, 'error' => 'locked'], 429);
    }

    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    $password = is_array($payload) ? (string)($payload['password'] ?? '') : '';
    if ($password === '') {
        $password = (string)($_POST['password'] ?? '');
    }

    if (!verifyPassword($password)) {
        recordFailedLogin();
        jsonResponse(['ok' => false, 'error' => 'password'], 401);
    }

    clearLoginAttempts();
    session_regenerate_id(true);
    $_SESSION['admin_logged_in'] = true;
    jsonResponse(['ok' => true, 'csrf' => csrfToken()]);
}

if ($action === 'logout') {
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    jsonResponse(['ok' => true]);
}

if ($action === 'session') {
    jsonResponse([
        'ok' => true,
        'loggedIn' => isLoggedIn(),
        'csrf' => isLoggedIn() ? csrfToken() : null,
    ]);
}

requireLogin();

if ($action === 'list') {
    $photos = galleryPhotos(readGallery());
    jsonResponse(['ok' => true, 'photos' => $photos, 'csrf' => csrfToken()]);
}

if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verifyCsrf($_POST['csrf'] ?? null)) {
        jsonResponse(['ok' => false, 'error' => 'csrf'], 403);
    }

    if (empty($_FILES['photos'])) {
        jsonResponse(['ok' => false, 'error' => 'empty'], 400);
    }

    $files = $_FILES['photos'];
    if (!is_array($files['name'])) {
        $files = [
            'name' => [$files['name']],
            'type' => [$files['type']],
            'tmp_name' => [$files['tmp_name']],
            'error' => [$files['error']],
            'size' => [$files['size']],
        ];
    }
    $count = count($files['name']);
    if ($count < 1) {
        jsonResponse(['ok' => false, 'error' => 'empty'], 400);
    }

    $photos = galleryPhotos(readGallery());
    $added = [];

    for ($i = 0; $i < $count; $i += 1) {
        $file = [
            'name' => $files['name'][$i] ?? '',
            'type' => $files['type'][$i] ?? '',
            'tmp_name' => $files['tmp_name'][$i] ?? '',
            'error' => $files['error'][$i] ?? UPLOAD_ERR_NO_FILE,
            'size' => $files['size'][$i] ?? 0,
        ];
        $result = storeUploadedImage($file);
        if (!$result['ok']) {
            continue;
        }
        $photo = [
            'id' => uniquePhotoId(),
            'file' => $result['file'],
            'caption' => 'Фото ' . (count($photos) + count($added) + 1),
        ];
        $photos[] = $photo;
        $added[] = $photo;
    }

    if (!$added) {
        jsonResponse(['ok' => false, 'error' => 'upload'], 400);
    }

    if (!saveGalleryPhotos($photos)) {
        foreach ($added as $photo) {
            deletePhotoFile($photo['file']);
        }
        jsonResponse(['ok' => false, 'error' => 'storage'], 500);
    }

    jsonResponse(['ok' => true, 'added' => $added, 'photos' => $photos, 'csrf' => csrfToken()]);
}

if ($action === 'replace' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verifyCsrf($_POST['csrf'] ?? null)) {
        jsonResponse(['ok' => false, 'error' => 'csrf'], 403);
    }

    $id = sanitizeId((string)($_POST['id'] ?? ''));
    if ($id === '' || empty($_FILES['photo'])) {
        jsonResponse(['ok' => false, 'error' => 'empty'], 400);
    }

    $photos = galleryPhotos(readGallery());
    $index = null;
    foreach ($photos as $i => $photo) {
        if ($photo['id'] === $id) {
            $index = $i;
            break;
        }
    }
    if ($index === null) {
        jsonResponse(['ok' => false, 'error' => 'notfound'], 404);
    }

    $result = storeUploadedImage($_FILES['photo']);
    if (!$result['ok']) {
        jsonResponse(['ok' => false, 'error' => $result['error'] ?? 'upload'], 400);
    }

    $oldFile = $photos[$index]['file'];
    $photos[$index]['file'] = $result['file'];

    if (!saveGalleryPhotos($photos)) {
        deletePhotoFile($result['file']);
        jsonResponse(['ok' => false, 'error' => 'storage'], 500);
    }

    deletePhotoFile($oldFile);
    jsonResponse(['ok' => true, 'photos' => $photos, 'csrf' => csrfToken()]);
}

if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($payload) || !verifyCsrf($payload['csrf'] ?? null)) {
        jsonResponse(['ok' => false, 'error' => 'csrf'], 403);
    }

    $id = sanitizeId((string)($payload['id'] ?? ''));
    if ($id === '') {
        jsonResponse(['ok' => false, 'error' => 'empty'], 400);
    }

    $photos = galleryPhotos(readGallery());
    $removed = null;
    $next = [];

    foreach ($photos as $photo) {
        if ($photo['id'] === $id) {
            $removed = $photo;
            continue;
        }
        $next[] = $photo;
    }

    if ($removed === null) {
        jsonResponse(['ok' => false, 'error' => 'notfound'], 404);
    }

    if (!saveGalleryPhotos($next)) {
        jsonResponse(['ok' => false, 'error' => 'storage'], 500);
    }

    deletePhotoFile($removed['file']);
    jsonResponse(['ok' => true, 'photos' => $next, 'csrf' => csrfToken()]);
}

if ($action === 'caption' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($payload) || !verifyCsrf($payload['csrf'] ?? null)) {
        jsonResponse(['ok' => false, 'error' => 'csrf'], 403);
    }

    $id = sanitizeId((string)($payload['id'] ?? ''));
    $caption = trim((string)($payload['caption'] ?? ''));
    if ($id === '') {
        jsonResponse(['ok' => false, 'error' => 'empty'], 400);
    }
    if ($caption === '') {
        jsonResponse(['ok' => false, 'error' => 'caption'], 400);
    }
    if (mb_strlen($caption) > 120) {
        $caption = mb_substr($caption, 0, 120);
    }

    $photos = galleryPhotos(readGallery());
    $found = false;
    foreach ($photos as &$photo) {
        if ($photo['id'] === $id) {
            $photo['caption'] = $caption;
            $found = true;
            break;
        }
    }
    unset($photo);

    if (!$found) {
        jsonResponse(['ok' => false, 'error' => 'notfound'], 404);
    }

    if (!saveGalleryPhotos($photos)) {
        jsonResponse(['ok' => false, 'error' => 'storage'], 500);
    }

    jsonResponse(['ok' => true, 'photos' => $photos, 'csrf' => csrfToken()]);
}

if ($action === 'reorder' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($payload) || !verifyCsrf($payload['csrf'] ?? null)) {
        jsonResponse(['ok' => false, 'error' => 'csrf'], 403);
    }

    $order = $payload['order'] ?? null;
    if (!is_array($order)) {
        jsonResponse(['ok' => false, 'error' => 'empty'], 400);
    }

    $photos = galleryPhotos(readGallery());
    $map = [];
    foreach ($photos as $photo) {
        $map[$photo['id']] = $photo;
    }

    $next = [];
    foreach ($order as $id) {
        $id = sanitizeId((string)$id);
        if ($id !== '' && isset($map[$id])) {
            $next[] = $map[$id];
            unset($map[$id]);
        }
    }
    foreach ($map as $photo) {
        $next[] = $photo;
    }

    if (!saveGalleryPhotos($next)) {
        jsonResponse(['ok' => false, 'error' => 'storage'], 500);
    }

    jsonResponse(['ok' => true, 'photos' => $next, 'csrf' => csrfToken()]);
}

jsonResponse(['ok' => false, 'error' => 'unknown'], 404);
