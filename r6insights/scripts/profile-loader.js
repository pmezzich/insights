/**
 * profile-loader.js
 * ─────────────────────────────────────────────────────────
 * Drop one <script> tag into any page after firebase-config.js
 * and it automatically:
 *   1. Finds the #navAvatar element in the nav
 *   2. Loads the user's avatar + primary display name from Firebase
 *   3. Renders avatar image (or initials fallback)
 *   4. Links to profile.html on click
 *
 * Requires: Firebase Auth + Database already initialized on the page.
 */

(function () {
    'use strict';

    function getInitial(user, profileData) {
        const name = profileData?.activeDisplayName
            || profileData?.displayName
            || user?.displayName
            || user?.email
            || '?';
        return name[0].toUpperCase();
    }

    function renderAvatar(el, user, profileData) {
        const initial  = getInitial(user, profileData);
        const avatar   = profileData?.avatar;
        el.title       = profileData?.activeDisplayName || profileData?.displayName || user?.email || 'Profile';

        if (avatar) {
            el.innerHTML = `<img src="${avatar}" alt="avatar">`;
        } else {
            el.textContent = initial;
        }
    }

    // Wait until Firebase auth resolves
    function init() {
        const auth = firebase.auth();
        const db   = firebase.database();

        auth.onAuthStateChanged(async (user) => {
            const el = document.getElementById('navAvatar');
            if (!el || !user) return;

            try {
                const snap = await db.ref(`users/${user.uid}/profile`).once('value');
                renderAvatar(el, user, snap.val() || {});
            } catch (_) {
                // Fallback to initials if DB read fails
                const initial = (user.email || '?')[0].toUpperCase();
                el.textContent = initial;
            }
        });
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
