/**
 * R6 Insights — Theme Engine v3
 */
window.R6Theme = (function () {
    'use strict';

    var LS_KEY  = 'r6_theme';
    var DB_PATH = 'users/{uid}/theme';
    var LIGHT   = 'light';
    var DARK    = 'dark';
    var _uid    = null;
    var _db     = null;

    console.log('[R6Theme] script loaded');

    // ── Lever styles injected directly so no CSS file needed ─────────────────
    (function injectStyles() {
        if (document.getElementById('r6-theme-css')) return;
        var s = document.createElement('style');
        s.id = 'r6-theme-css';
        s.textContent =
            '.r6-theme-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:4px 0;}' +
            '.r6-theme-info{display:flex;align-items:center;gap:12px;}' +
            '.r6-theme-icon{width:36px;height:36px;border-radius:9px;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.25);color:#a78bfa;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}' +
            '.r6-theme-title{font-size:14px;font-weight:700;color:var(--light,#F8FAFC);}' +
            '.r6-theme-sub{font-size:12px;color:var(--gray,#94A3B8);margin-top:2px;}' +
            /* lever wrapper */
            '.r6-lever{position:relative;display:inline-block;width:56px;height:28px;cursor:pointer;flex-shrink:0;user-select:none;}' +
            /* hidden real checkbox — covers full lever for click */
            '.r6-lever input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:2;}' +
            /* track */
            '.r6-lever-track{position:absolute;inset:0;border-radius:14px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);transition:background .28s,border-color .28s,box-shadow .28s;pointer-events:none;}' +
            /* thumb */
            '.r6-lever-thumb{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#64748B;box-shadow:0 1px 4px rgba(0,0,0,0.4);transition:transform .28s cubic-bezier(.34,1.56,.64,1),background .28s;pointer-events:none;}' +
            /* checked = light */
            '.r6-lever input:checked ~ .r6-lever-track{background:rgba(124,58,237,0.35);border-color:rgba(124,58,237,0.6);box-shadow:0 0 0 3px rgba(124,58,237,0.15);}' +
            '.r6-lever input:checked ~ .r6-lever-thumb{transform:translateX(28px);background:#a78bfa;}' +
            /* hover */
            '.r6-lever:hover .r6-lever-track{border-color:rgba(124,58,237,0.5);}' +
            /* light-mode text fixes */
            'html.light-mode .r6-theme-title{color:#0F172A !important;}' +
            'html.light-mode .r6-theme-sub{color:#475569 !important;}';
        (document.head || document.documentElement).appendChild(s);
        console.log('[R6Theme] styles injected');
    })();

    // ── Apply theme to <html> ─────────────────────────────────────────────────
    function apply(theme) {
        console.log('[R6Theme] apply:', theme);
        document.documentElement.classList.toggle('light-mode', theme === LIGHT);
        localStorage.setItem(LS_KEY, theme);

        // sync all levers + labels on this page
        document.querySelectorAll('.r6-lever input').forEach(function(cb) {
            cb.checked = (theme === LIGHT);
        });
        document.querySelectorAll('.r6-theme-sub').forEach(function(el) {
            el.textContent = (theme === LIGHT) ? 'Light Mode' : 'Dark Mode';
        });
        document.querySelectorAll('.r6-theme-icon i').forEach(function(el) {
            el.className = 'fas ' + (theme === LIGHT ? 'fa-sun' : 'fa-moon');
        });
    }

    function current() {
        return localStorage.getItem(LS_KEY) || DARK;
    }

    // ── Firebase ──────────────────────────────────────────────────────────────
    function _save(theme) {
        if (!_uid || !_db) return;
        _db.ref(DB_PATH.replace('{uid}', _uid)).set(theme).catch(function(){});
    }
    function _syncFromDB() {
        if (!_uid || !_db) return;
        _db.ref(DB_PATH.replace('{uid}', _uid)).once('value').then(function(snap) {
            var v = snap.val();
            console.log('[R6Theme] firebase value:', v);
            if (v === LIGHT || v === DARK) apply(v);
        }).catch(function(e) { console.warn('[R6Theme] firebase error', e); });
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init(uid, db) {
        _uid = uid;
        _db  = db;
        console.log('[R6Theme] init uid:', uid);
        apply(current());
        _syncFromDB();
    }

    // ── Render lever UI ───────────────────────────────────────────────────────
    function renderToggle(containerId) {
        var el = document.getElementById(containerId);
        if (!el) { console.warn('[R6Theme] container not found:', containerId); return; }

        var isLight = current() === LIGHT;
        el.innerHTML =
            '<div class="r6-theme-row">' +
              '<div class="r6-theme-info">' +
                '<div class="r6-theme-icon"><i class="fas ' + (isLight ? 'fa-sun' : 'fa-moon') + '"></i></div>' +
                '<div>' +
                  '<div class="r6-theme-title">Appearance</div>' +
                  '<div class="r6-theme-sub">' + (isLight ? 'Light Mode' : 'Dark Mode') + '</div>' +
                '</div>' +
              '</div>' +
              '<label class="r6-lever" title="Toggle light / dark mode">' +
                '<input type="checkbox"' + (isLight ? ' checked' : '') + '>' +
                '<div class="r6-lever-track"></div>' +
                '<div class="r6-lever-thumb"></div>' +
              '</label>' +
            '</div>';

        // checkbox change — most reliable trigger
        el.querySelector('.r6-lever input').addEventListener('change', function() {
            var next = this.checked ? LIGHT : DARK;
            console.log('[R6Theme] lever changed to:', next);
            apply(next);
            _save(next);
        });

        console.log('[R6Theme] lever rendered, isLight:', isLight);
    }

    return { init: init, apply: apply, current: current, renderToggle: renderToggle };
})();
