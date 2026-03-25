/**
 * R6 Insights — Theme Engine v2
 * Self-contained: injects its own lever styles, no CSS file dependency.
 */

window.R6Theme = (function () {
    'use strict';

    const LS_KEY  = 'r6_theme';
    const DB_PATH = 'users/{uid}/theme';
    const LIGHT   = 'light';
    const DARK    = 'dark';

    var _uid = null;
    var _db  = null;

    // ── Inject lever styles once ──────────────────────────────────────────────
    (function injectStyles() {
        if (document.getElementById('r6-theme-styles')) return;
        var s = document.createElement('style');
        s.id = 'r6-theme-styles';
        s.textContent = [
            '.r6-theme-row{display:flex;align-items:center;justify-content:space-between;gap:16px;}',
            '.r6-theme-info{display:flex;align-items:center;gap:12px;}',
            '.r6-theme-icon{width:36px;height:36px;border-radius:9px;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.25);color:#a78bfa;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}',
            '.r6-theme-title{font-size:14px;font-weight:700;color:var(--light,#F8FAFC);}',
            '.r6-theme-sublabel{font-size:12px;color:var(--gray,#94A3B8);margin-top:2px;transition:color .2s;}',
            /* Lever */
            '.r6-lever{position:relative;width:64px;height:30px;flex-shrink:0;cursor:pointer;-webkit-tap-highlight-color:transparent;}',
            '.r6-lever-track{position:absolute;inset:0;border-radius:15px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);transition:background .3s,border-color .3s,box-shadow .3s;}',
            '.r6-lever-track::before{content:"\\f186";font-family:"Font Awesome 6 Free";font-weight:900;font-size:11px;position:absolute;left:8px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.4);transition:opacity .25s;}',
            '.r6-lever-track::after{content:"\\f185";font-family:"Font Awesome 6 Free";font-weight:900;font-size:11px;position:absolute;right:8px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0);transition:color .25s;}',
            '.r6-lever-thumb{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#94A3B8;box-shadow:0 1px 4px rgba(0,0,0,0.4);transition:transform .3s cubic-bezier(.34,1.56,.64,1),background .3s;}',
            /* Light state */
            '.r6-lever.is-light .r6-lever-track{background:rgba(124,58,237,0.28);border-color:rgba(124,58,237,0.5);box-shadow:0 0 0 3px rgba(124,58,237,0.12);}',
            '.r6-lever.is-light .r6-lever-track::before{color:rgba(255,255,255,0);}',
            '.r6-lever.is-light .r6-lever-track::after{color:#fbbf24;}',
            '.r6-lever.is-light .r6-lever-thumb{transform:translateX(34px);background:#a78bfa;}',
            '.r6-lever:hover .r6-lever-track{border-color:rgba(124,58,237,0.6);}',
            /* Light mode text fixes */
            'html.light-mode .r6-theme-title{color:#0F172A;}',
            'html.light-mode .r6-theme-sublabel{color:#475569;}',
            'html.light-mode .r6-lever-track{background:rgba(15,23,42,0.08);border-color:rgba(15,23,42,0.18);}',
        ].join('');
        (document.head || document.documentElement).appendChild(s);
    })();

    // ── Apply theme ───────────────────────────────────────────────────────────
    function apply(theme) {
        if (theme === LIGHT) {
            document.documentElement.classList.add('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
        }
        localStorage.setItem(LS_KEY, theme);
        _syncUI(theme);
    }

    function _syncUI(theme) {
        var isLight = (theme === LIGHT);
        document.querySelectorAll('.r6-lever').forEach(function (el) {
            el.classList.toggle('is-light', isLight);
            el.setAttribute('aria-checked', String(isLight));
        });
        document.querySelectorAll('.r6-theme-sublabel').forEach(function (el) {
            el.textContent = isLight ? 'Light Mode' : 'Dark Mode';
        });
        document.querySelectorAll('.r6-theme-icon i').forEach(function (el) {
            el.className = 'fas ' + (isLight ? 'fa-sun' : 'fa-moon');
        });
    }

    function current() {
        return localStorage.getItem(LS_KEY) || DARK;
    }

    // ── Firebase ──────────────────────────────────────────────────────────────
    function syncFromFirebase(uid, db) {
        if (!uid || !db) return;
        var path = DB_PATH.replace('{uid}', uid);
        db.ref(path).once('value').then(function (snap) {
            var saved = snap.val();
            if (saved === LIGHT || saved === DARK) apply(saved);
        }).catch(function () {});
    }

    function saveToFirebase(theme) {
        if (!_uid || !_db) return;
        var path = DB_PATH.replace('{uid}', _uid);
        _db.ref(path).set(theme).catch(function () {});
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init(uid, db) {
        _uid = uid;
        _db  = db;
        apply(current());
        syncFromFirebase(uid, db);
    }

    // ── Render lever into container ───────────────────────────────────────────
    function renderToggle(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var isLight = current() === LIGHT;

        container.innerHTML =
            '<div class="r6-theme-row">' +
              '<div class="r6-theme-info">' +
                '<div class="r6-theme-icon"><i class="fas ' + (isLight ? 'fa-sun' : 'fa-moon') + '"></i></div>' +
                '<div>' +
                  '<div class="r6-theme-title">Appearance</div>' +
                  '<div class="r6-theme-sublabel">' + (isLight ? 'Light Mode' : 'Dark Mode') + '</div>' +
                '</div>' +
              '</div>' +
              '<div class="r6-lever' + (isLight ? ' is-light' : '') + '" ' +
                   'role="switch" aria-checked="' + isLight + '" title="Toggle light / dark mode">' +
                '<div class="r6-lever-track"></div>' +
                '<div class="r6-lever-thumb"></div>' +
              '</div>' +
            '</div>';

        container.querySelector('.r6-lever').addEventListener('click', function () {
            var next = current() === LIGHT ? DARK : LIGHT;
            apply(next);
            saveToFirebase(next);
        });
    }

    return { init: init, apply: apply, current: current, renderToggle: renderToggle };
})();
