(function () {
  'use strict';

  var RATE_KEY = 'lp_review_submit';
  var REVIEW_DAY_KEY = 'lp_review_day_count';
  var MAX_SUBMITS = 3;
  var MAX_REVIEWS_PER_DAY = 5;
  var WINDOW_MS = 60 * 60 * 1000;
  var MIN_PAGE_MS = 2500;
  var MAX_NAME = 60;
  var MAX_TEXT = 800;
  var SUSPICIOUS = /<script|javascript:|data:text\/html|on\w+\s*=|<iframe|<object|<embed/i;

  var pageLoadedAt = Date.now();

  function getSubmitLog() {
    try {
      var raw = sessionStorage.getItem(RATE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return [];
  }

  function saveSubmitLog(times) {
    try {
      sessionStorage.setItem(RATE_KEY, JSON.stringify(times));
    } catch (e) { /* ignore */ }
  }

  function isRateLimited() {
    var now = Date.now();
    var recent = getSubmitLog().filter(function (t) {
      return now - t < WINDOW_MS;
    });
    saveSubmitLog(recent);
    return recent.length >= MAX_SUBMITS;
  }

  function recordSubmit() {
    var now = Date.now();
    var recent = getSubmitLog().filter(function (t) {
      return now - t < WINDOW_MS;
    });
    recent.push(now);
    saveSubmitLog(recent);
    recordDailyReview();
  }

  function getDayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }

  function getDailyReviewCount() {
    try {
      var raw = localStorage.getItem(REVIEW_DAY_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data.day === getDayKey()) return data.count || 0;
      }
    } catch (e) { /* ignore */ }
    return 0;
  }

  function recordDailyReview() {
    try {
      localStorage.setItem(REVIEW_DAY_KEY, JSON.stringify({
        day: getDayKey(),
        count: getDailyReviewCount() + 1
      }));
    } catch (e) { /* ignore */ }
  }

  function isDailyLimitReached() {
    return getDailyReviewCount() >= MAX_REVIEWS_PER_DAY;
  }

  function isHoneypotFilled() {
    var website = document.getElementById('reviewWebsite');
    var email = document.getElementById('reviewEmail');
    if (website && website.value.trim().length > 0) return true;
    if (email && email.value.trim().length > 0) return true;
    return false;
  }

  function isTooFast() {
    return Date.now() - pageLoadedAt < MIN_PAGE_MS;
  }

  function stripControlChars(str) {
    return String(str || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  function sanitizeName(str) {
    return stripControlChars(str).replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  }

  function sanitizeText(str) {
    return stripControlChars(str).replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  }

  function hasSuspiciousContent(str) {
    return SUSPICIOUS.test(str);
  }

  window.LPSecurity = {
    canSubmitReview: function () {
      if (isHoneypotFilled()) return { ok: false, reason: 'spam' };
      if (isTooFast()) return { ok: false, reason: 'fast' };
      if (isRateLimited()) return { ok: false, reason: 'rate' };
      if (isDailyLimitReached()) return { ok: false, reason: 'daily' };
      return { ok: true };
    },
    recordReviewSubmit: recordSubmit,
    sanitizeName: sanitizeName,
    sanitizeText: sanitizeText,
    hasSuspiciousContent: hasSuspiciousContent
  };
})();
