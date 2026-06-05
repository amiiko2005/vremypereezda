<?php
declare(strict_types=1);

const ADMIN_PASSWORD_HEX = 'd0b0d180d182d0b5d0bcd0bfd0b5d180d0b5d0b5d0b7d0b4';
const ADMIN_PASSWORD = 'артемпереезд';
const ROOT_DIR = __DIR__ . '/..';
const GALLERY_JSON = ROOT_DIR . '/data/gallery.json';
const GALLERY_DIR = ROOT_DIR . '/images/gallery/work';
const GALLERY_URL_PREFIX = 'images/gallery/work/';
const PHOTOS_PER_PAGE = 6;
const MAX_UPLOAD_BYTES = 8388608;
const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 82;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_SECONDS = 900;
