<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function adminBasePath(): string
{
    $script = str_replace('\\', '/', (string)($_SERVER['SCRIPT_NAME'] ?? '/admin/api.php'));
    $dir = rtrim(str_replace('\\', '/', dirname($script)), '/');
    if ($dir === '' || $dir === '.') {
        return '/';
    }
    return $dir . '/';
}

function startAdminSession(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => adminBasePath(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function jsonResponse(array $payload, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function readGallery(): array
{
    if (!is_file(GALLERY_JSON)) {
        return ['photos' => []];
    }
    $raw = file_get_contents(GALLERY_JSON);
    $data = json_decode($raw ?: '', true);
    if (!is_array($data) || !isset($data['photos']) || !is_array($data['photos'])) {
        return ['photos' => []];
    }
    return $data;
}

function writeGallery(array $data): bool
{
    $dir = dirname(GALLERY_JSON);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        return false;
    }
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) {
        return false;
    }
    return file_put_contents(GALLERY_JSON, $json . "\n", LOCK_EX) !== false;
}

function isLoggedIn(): bool
{
    return !empty($_SESSION['admin_logged_in']);
}

function requireLogin(): void
{
    if (!isLoggedIn()) {
        jsonResponse(['ok' => false, 'error' => 'auth'], 401);
    }
}

function csrfToken(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrf(?string $token): bool
{
    return is_string($token)
        && !empty($_SESSION['csrf_token'])
        && hash_equals($_SESSION['csrf_token'], $token);
}

function loginAttemptsBlocked(): bool
{
    $attempts = (int)($_SESSION['login_attempts'] ?? 0);
    $lockedUntil = (int)($_SESSION['login_locked_until'] ?? 0);
    if ($lockedUntil > time()) {
        return true;
    }
    if ($lockedUntil > 0 && $lockedUntil <= time()) {
        unset($_SESSION['login_attempts'], $_SESSION['login_locked_until']);
    }
    return $attempts >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedLogin(): void
{
    $attempts = (int)($_SESSION['login_attempts'] ?? 0) + 1;
    $_SESSION['login_attempts'] = $attempts;
    if ($attempts >= LOGIN_MAX_ATTEMPTS) {
        $_SESSION['login_locked_until'] = time() + LOGIN_LOCK_SECONDS;
    }
}

function clearLoginAttempts(): void
{
    unset($_SESSION['login_attempts'], $_SESSION['login_locked_until']);
}

function verifyPassword(string $password): bool
{
    $expected = ADMIN_PASSWORD;
    if (defined('ADMIN_PASSWORD_HEX') && ADMIN_PASSWORD_HEX !== '') {
        $decoded = hex2bin(ADMIN_PASSWORD_HEX);
        if ($decoded !== false) {
            $expected = $decoded;
        }
    }
    return hash_equals($expected, $password);
}

function sanitizeId(string $id): string
{
    return preg_replace('/[^a-zA-Z0-9_-]/', '', $id) ?? '';
}

function galleryPhotos(array $data): array
{
    $photos = [];
    foreach ($data['photos'] as $photo) {
        if (!is_array($photo) || empty($photo['file']) || empty($photo['id'])) {
            continue;
        }
        $path = ROOT_DIR . '/' . ltrim(str_replace('\\', '/', $photo['file']), '/');
        if (!is_file($path)) {
            continue;
        }
        $photos[] = [
            'id' => sanitizeId((string)$photo['id']),
            'file' => str_replace('\\', '/', (string)$photo['file']),
            'caption' => trim((string)($photo['caption'] ?? '')),
        ];
    }
    return $photos;
}

function saveGalleryPhotos(array $photos): bool
{
    return writeGallery(['photos' => array_values($photos)]);
}

function uniquePhotoId(): string
{
    return 'photo-' . bin2hex(random_bytes(4));
}

function uniqueFilename(string $ext): string
{
    return 'work-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.' . $ext;
}

function detectImageExtension(string $path): ?string
{
    $info = @getimagesize($path);
    if (!$info) {
        return null;
    }
    $map = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        IMAGETYPE_WEBP => 'webp',
    ];
    return $map[$info[2]] ?? null;
}

function optimizeImage(string $path, string $ext): bool
{
    if (!function_exists('imagecreatetruecolor')) {
        return true;
    }

    $info = @getimagesize($path);
    if (!$info) {
        return false;
    }

    [$width, $height, $type] = $info;
    $src = null;

    if ($type === IMAGETYPE_JPEG && function_exists('imagecreatefromjpeg')) {
        $src = @imagecreatefromjpeg($path);
    } elseif ($type === IMAGETYPE_PNG && function_exists('imagecreatefrompng')) {
        $src = @imagecreatefrompng($path);
    } elseif ($type === IMAGETYPE_WEBP && function_exists('imagecreatefromwebp')) {
        $src = @imagecreatefromwebp($path);
    }

    if (!$src) {
        return $ext === 'jpg';
    }

    if ($width > MAX_IMAGE_SIDE || $height > MAX_IMAGE_SIDE) {
        $ratio = min(MAX_IMAGE_SIDE / $width, MAX_IMAGE_SIDE / $height);
        $newW = (int)round($width * $ratio);
        $newH = (int)round($height * $ratio);
        $dst = imagecreatetruecolor($newW, $newH);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $width, $height);
        imagedestroy($src);
        $src = $dst;
        $width = $newW;
        $height = $newH;
    }

    $saved = false;
    if ($ext === 'jpg') {
        $saved = imagejpeg($src, $path, JPEG_QUALITY);
    } elseif ($ext === 'png') {
        $saved = imagepng($src, $path, 6);
    } elseif ($ext === 'webp' && function_exists('imagewebp')) {
        $saved = imagewebp($src, $path, JPEG_QUALITY);
    }

    imagedestroy($src);
    return (bool)$saved;
}

function storeUploadedImage(array $file): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return ['ok' => false, 'error' => 'upload'];
    }
    if (($file['size'] ?? 0) > MAX_UPLOAD_BYTES) {
        return ['ok' => false, 'error' => 'size'];
    }

    $tmp = (string)($file['tmp_name'] ?? '');
    if ($tmp === '' || !is_uploaded_file($tmp)) {
        return ['ok' => false, 'error' => 'upload'];
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? finfo_file($finfo, $tmp) : '';
    if ($finfo) {
        finfo_close($finfo);
    }

    $allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($mime, $allowed, true)) {
        return ['ok' => false, 'error' => 'type'];
    }

    $ext = detectImageExtension($tmp);
    if ($ext === null) {
        return ['ok' => false, 'error' => 'type'];
    }

    if (!is_dir(GALLERY_DIR) && !mkdir(GALLERY_DIR, 0755, true)) {
        return ['ok' => false, 'error' => 'storage'];
    }

    $filename = uniqueFilename($ext);
    $dest = GALLERY_DIR . '/' . $filename;
    if (!move_uploaded_file($tmp, $dest)) {
        return ['ok' => false, 'error' => 'storage'];
    }

    if ($ext === 'jpg' || $ext === 'webp') {
        optimizeImage($dest, $ext);
    } elseif ($ext === 'png') {
        optimizeImage($dest, 'png');
    }

    return [
        'ok' => true,
        'file' => GALLERY_URL_PREFIX . $filename,
    ];
}

function deletePhotoFile(string $file): void
{
    $relative = ltrim(str_replace('\\', '/', $file), '/');
    if (strpos($relative, GALLERY_URL_PREFIX) !== 0) {
        return;
    }
    $path = ROOT_DIR . '/' . $relative;
    if (is_file($path)) {
        @unlink($path);
    }
}
