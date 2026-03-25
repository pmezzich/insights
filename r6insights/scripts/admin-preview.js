/**
 * admin-preview.js
 * ─────────────────────────────────────────────────────────
 * Allows an admin to "view as" any team by storing the
 * target teamId in sessionStorage before navigating here.
 *
 * HOW TO USE IN EACH PAGE:
 *   1. Add this script tag after firebase-config.js:
 *      <script src="../scripts/admin-preview.js"></script>
 *
 *   2. In your page's auth callback, after confirming the
 *      user is authenticated, call:
 *        const teamId = await getPreviewTeamId(user);
 *      instead of reading users/${uid}/teamId directly.
 *
 *   3. If in preview mode, a banner appears at the top of
 *      the page showing which team is being previewed.
 *
 * The preview is session-scoped — closing the tab clears it.
 * Only works when the viewer is a confirmed admin.
 */

const ADMIN_PREVIEW_KEY      = 'adminPreviewTeamId';
const ADMIN_PREVIEW_NAME_KEY = 'adminPreviewTeamName';

/**
 * Returns the teamId to use for this page load.
 * If the user is an admin and a preview teamId is stored,
 * returns that instead of the user's own teamId.
 * Falls back to users/{uid}/teamId otherwise.
 */
async function getPreviewTeamId(user, db) {
    const previewId = sessionStorage.getItem(ADMIN_PREVIEW_KEY);

    if (previewId) {
        // Confirm the viewer is actually an admin
        const adminSnap = await db.ref(`admins/${user.uid}`).once('value');
        if (adminSnap.exists()) {
            injectPreviewBanner();
            return previewId;
        }
        // Not an admin — clear the stale key silently
        sessionStorage.removeItem(ADMIN_PREVIEW_KEY);
        sessionStorage.removeItem(ADMIN_PREVIEW_NAME_KEY);
    }

    // Normal path — return the user's own teamId
    const snap = await db.ref(`users/${user.uid}/teamId`).once('value');
    return snap.val();
}

/**
 * Injects a visible banner at the top of the page so the
 * admin always knows they are in preview mode.
 */
function injectPreviewBanner() {
    if (document.getElementById('adminPreviewBanner')) return;
    const teamName = sessionStorage.getItem(ADMIN_PREVIEW_NAME_KEY) || 'Unknown Team';
    const banner   = document.createElement('div');
    banner.id      = 'adminPreviewBanner';
    banner.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
        'background:linear-gradient(135deg,#B45309,#F59E0B)',
        'color:#111', 'font-size:13px', 'font-weight:700',
        'padding:8px 20px', 'display:flex', 'align-items:center',
        'justify-content:space-between', 'gap:12px',
        'box-shadow:0 2px 12px rgba(245,158,11,0.4)',
    ].join(';');
    banner.innerHTML = `
        <span>
            <i class="fas fa-eye" style="margin-right:6px;"></i>
            Admin Preview — viewing as <strong>${teamName}</strong>
        </span>
        <button onclick="
            sessionStorage.removeItem('adminPreviewTeamId');
            sessionStorage.removeItem('adminPreviewTeamName');
            window.location.reload();
        " style="background:rgba(0,0,0,0.2);border:none;color:#111;font-weight:700;font-size:12px;padding:4px 10px;border-radius:6px;cursor:pointer;">
            ✕ Exit Preview
        </button>
    `;
    document.body.prepend(banner);
    // Push body down so banner doesn't overlap content
    document.body.style.paddingTop = '42px';
}
