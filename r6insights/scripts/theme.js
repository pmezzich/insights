/**
 * R6 Insights — Theme Engine
 * Handles dark/light mode across all pages.
 *
 * Usage on every page:
 *   1. In <head> (before any CSS): <script>if(localStorage.getItem('r6_theme')==='light')document.documentElement.classList.add('light-mode');</script>
 *   2. After firebase-config.js: <script src="../scripts/theme.js"></script>
 *
 * The profile page calls R6Theme.renderToggle(containerId) to show the toggle UI.
 */

window.R6Theme = (function () {
    'use strict';

    const LS_KEY   = 'r6_theme';
    const DB_PATH  = 'users/{uid}/theme'; // {uid} replaced at runtime
    const LIGHT    = 'light';
    const DARK     = 'dark';

    // ── Apply theme class immediately ────────────────────────────────────────
    function apply(theme) {
        if (theme === LIGHT) {
            document.documentElement.classList.add('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
        }
        localStorage.setItem(LS_KEY, theme);
        // Update any toggle switches already in the DOM
        document.querySelectorAll('.r6-theme-toggle-input').forEach(function (inp) {
            inp.checked = (theme === LIGHT);
        });
        document.querySelectorAll('.r6-theme-toggle-label').forEach(function (lbl) {
            lbl.textContent = (theme === LIGHT) ? 'Light Mode' : 'Dark Mode';
        });
    }

    // ── Current theme ────────────────────────────────────────────────────────
    function current() {
        return localStorage.getItem(LS_KEY) || DARK;
    }

    // ── Sync FROM Firebase (call once after auth resolves) ───────────────────
    function syncFromFirebase(uid, db) {
        if (!uid || !db) return;
        var path = DB_PATH.replace('{uid}', uid);
        db.ref(path).once('value').then(function (snap) {
            var saved = snap.val();
            if (saved === LIGHT || saved === DARK) {
                apply(saved);
            }
        }).catch(function () { /* silent — localStorage is the fallback */ });
    }

    // ── Save TO Firebase ─────────────────────────────────────────────────────
    function saveToFirebase(uid, db, theme) {
        if (!uid || !db) return;
        var path = DB_PATH.replace('{uid}', uid);
        db.ref(path).set(theme).catch(function () { /* silent */ });
    }

    // ── Toggle ────────────────────────────────────────────────────────────────
    var _uid = null;
    var _db  = null;

    function toggle() {
        var next = current() === LIGHT ? DARK : LIGHT;
        apply(next);
        saveToFirebase(_uid, _db, next);
    }

    // ── Init (call after auth state resolves on any page) ────────────────────
    function init(uid, db) {
        _uid = uid;
        _db  = db;
        // Apply from localStorage first (instant, no flash)
        apply(current());
        // Then sync from Firebase in case it differs (e.g. switched on another device)
        syncFromFirebase(uid, db);
    }

    // ── Render toggle UI into a container (profile page) ────────────────────
    function renderToggle(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var isLight = current() === LIGHT;
        container.innerHTML = [
            '<div class="r6-theme-row">',
            '  <div class="r6-theme-info">',
            '    <div class="r6-theme-icon"><i class="fas ' + (isLight ? 'fa-sun' : 'fa-moon') + '" id="r6ThemeIcon"></i></div>',
            '    <div>',
            '      <div class="r6-theme-title">Appearance</div>',
            '      <div class="r6-theme-label r6-theme-toggle-label">' + (isLight ? 'Light Mode' : 'Dark Mode') + '</div>',
            '    </div>',
            '  </div>',
            '  <label class="r6-toggle-switch" title="Toggle theme">',
            '    <input type="checkbox" class="r6-theme-toggle-input" ' + (isLight ? 'checked' : '') + ' onchange="R6Theme.onToggleChange(this)">',
            '    <span class="r6-toggle-track">',
            '      <span class="r6-toggle-thumb"></span>',
            '    </span>',
            '  </label>',
            '</div>'
        ].join('');
    }

    // Called by the checkbox onchange
    function onToggleChange(inp) {
        var next = inp.checked ? LIGHT : DARK;
        apply(next);
        saveToFirebase(_uid, _db, next);
        // Update icon
        var icon = document.getElementById('r6ThemeIcon');
        if (icon) {
            icon.className = 'fas ' + (next === LIGHT ? 'fa-sun' : 'fa-moon');
        }
    }

    return {
        init          : init,
        apply         : apply,
        toggle        : toggle,
        current       : current,
        renderToggle  : renderToggle,
        onToggleChange: onToggleChange
    };
})();
