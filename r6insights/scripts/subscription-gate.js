/**
 * R6 Insights — Subscription Gate
 * ─────────────────────────────────────────────────────────────────
 * Drop this script on any page that needs access control.
 * Call R6Gate.require(level) after Firebase auth resolves.
 *
 * ACCESS LEVELS (lowest → highest):
 *   'any'      — just needs to be logged in + email verified
 *   'sub'      — active subscription (solo or higher)
 *   'team'     — active subscription + on a team
 *   'staff'    — active subscription + captain/coach/analyst role
 *   'captain'  — active subscription + captain role
 *   'org'      — org_owner role
 *   'admin'    — /admins/{uid} exists in Firebase
 *
 * PAGE ACCESS MAP:
 *   profile, create_account, overview   → no gate (public)
 *   lft, lfp, stats_pro, team_setup     → 'sub'
 *   teamstats, compare, match_history,
 *   opponent_scouting, FinalVersion     → 'team'
 *   coach_suite + all coach tools       → 'staff'
 *   org_admin                           → 'org'
 *   admin                               → 'admin'
 *
 * USAGE:
 *   <script src="../scripts/subscription-gate.js"></script>
 *
 *   auth.onAuthStateChanged(async user => {
 *       if (!user || !user.emailVerified) { ... redirect ... }
 *       const access = await R6Gate.check(user, db);
 *       R6Gate.require('team', access); // redirects if insufficient
 *       // ... rest of page init
 *   });
 */

window.R6Gate = (function () {
    'use strict';

    const REDIRECT = 'index_pro.html';

    // Level hierarchy
    const LEVELS = { any:0, sub:1, team:2, staff:3, captain:4, org:5, admin:6 };

    /**
     * Fetches the user's full access context from Firebase.
     * Returns an object with everything the gate needs.
     */
    async function check(user, db) {
        if (!user || !user.emailVerified) return null;

        try {
            const [userSnap, adminSnap] = await Promise.all([
                db.ref(`users/${user.uid}`).once('value'),
                db.ref(`admins/${user.uid}`).once('value'),
            ]);

            const userData = userSnap.val() || {};
            const isAdmin  = adminSnap.exists();

            const sub      = userData.subscription || {};
            const now      = Date.now();
            const hasSub   = sub.plan && sub.expiresAt > now;
            const teamId   = userData.teamId || null;
            const orgId    = userData.orgId  || null;
            const orgOwner = userData.orgRole === 'owner';

            // Get team role if on a team
            let teamRole = null;
            if (teamId) {
                const roleSnap = await db.ref(`teams/${teamId}/players/${user.uid}/role`).once('value');
                teamRole = (roleSnap.val() || '').toLowerCase();
            }

            const isStaff   = ['captain','coach','analyst'].includes(teamRole);
            const isCaptain = teamRole === 'captain';

            // Determine effective level
            let level = 'any';
            if (hasSub)    level = 'sub';
            if (hasSub && teamId) level = 'team';
            if (hasSub && teamId && isStaff)   level = 'staff';
            if (hasSub && teamId && isCaptain) level = 'captain';
            if (orgOwner)  level = 'org';
            if (isAdmin)   level = 'admin';

            return { user, userData, sub, hasSub, teamId, teamRole, isStaff, isCaptain, orgId, orgOwner, isAdmin, level };

        } catch (e) {
            console.error('[R6Gate] check error:', e);
            return null;
        }
    }

    /**
     * Enforce a minimum access level.
     * Redirects with a reason param if insufficient.
     */
    function require(minLevel, access) {
        if (!access) {
            _redirect('not_logged_in');
            return false;
        }

        const required = LEVELS[minLevel] ?? 0;
        const actual   = LEVELS[access.level] ?? 0;

        if (actual >= required) return true;

        // Redirect with the appropriate reason
        if (!access.hasSub && required >= LEVELS.sub) {
            _redirect('no_subscription');
        } else if (!access.teamId && required >= LEVELS.team) {
            _redirect('no_team');
        } else if (!access.isStaff && required >= LEVELS.staff) {
            _redirect('not_staff');
        } else if (!access.isCaptain && required >= LEVELS.captain) {
            _redirect('not_captain');
        } else if (!access.orgOwner && required >= LEVELS.org) {
            _redirect('not_org');
        } else {
            _redirect('insufficient_access');
        }
        return false;
    }

    function _redirect(reason) {
        window.location.href = REDIRECT + '?gated=' + reason;
    }

    /**
     * Show an inline "locked" banner instead of redirecting.
     * Useful for soft-gating sections within a page.
     */
    function showBanner(reason, containerId) {
        const messages = {
            no_subscription: { icon:'fa-credit-card', title:'Subscription Required',  msg:'You need an active subscription to access this. <a href="profile.html">Redeem a code</a> or <a href="overview.html">view plans</a>.', col:'#fbbf24' },
            no_team:         { icon:'fa-users',       title:'Team Required',          msg:'Join or create a team to access this feature. <a href="team_setup.html">Set up your team</a>.', col:'#a78bfa' },
            not_staff:       { icon:'fa-lock',        title:'Coaches & Captains Only', msg:'This section is restricted to captains, coaches, and analysts.', col:'#f87171' },
            not_captain:     { icon:'fa-shield-halved',title:'Captain Only',          msg:'Only the team captain can access this.', col:'#f87171' },
            not_org:         { icon:'fa-building',    title:'Org Owner Required',     msg:'This panel is for organisation owners only.', col:'#fbbf24' },
        };
        const m = messages[reason] || { icon:'fa-lock', title:'Access Restricted', msg:'You do not have permission to view this.', col:'#f87171' };
        const el = containerId ? document.getElementById(containerId) : document.body;
        if (!el) return;
        const banner = document.createElement('div');
        banner.style.cssText = `padding:24px;text-align:center;background:rgba(15,23,42,.8);border:1px solid ${m.col}33;border-radius:12px;margin:20px;`;
        banner.innerHTML = `
            <i class="fas ${m.icon}" style="font-size:32px;color:${m.col};opacity:.6;display:block;margin-bottom:12px;"></i>
            <div style="font-size:16px;font-weight:800;color:#F8FAFC;margin-bottom:8px;">${m.title}</div>
            <div style="font-size:13px;color:#94A3B8;line-height:1.7;">${m.msg}</div>`;
        el.appendChild(banner);
    }

    /**
     * Lock hub cards the user can't access.
     * Cards must have data-gate="level" attribute.
     * Uses an overlay div instead of relying on overflow:hidden-clipped badges.
     */
    function applyHubGates(access) {
        document.querySelectorAll('[data-gate]').forEach(el => {
            const needed = LEVELS[el.dataset.gate] ?? 0;
            const actual = LEVELS[access?.level ?? 'any'] ?? 0;
            if (actual < needed) {
                // Dim and block clicks
                el.style.opacity       = '0.4';
                el.style.pointerEvents = 'none';
                el.style.cursor        = 'default';
                el.style.userSelect    = 'none';
                // Remove href so screen readers/tab don't navigate
                if (el.tagName === 'A') el.removeAttribute('href');

                // Inject overlay (works even with overflow:hidden parent)
                if (!el.querySelector('.gate-lock')) {
                    const label = _lockLabel(el.dataset.gate, access);
                    const lock  = document.createElement('div');
                    lock.className  = 'gate-lock';
                    lock.style.cssText = [
                        'position:absolute','inset:0','z-index:10',
                        'display:flex','align-items:center','justify-content:center',
                        'border-radius:inherit',
                        'background:rgba(5,8,15,0.55)',
                        'backdrop-filter:blur(2px)',
                    ].join(';');
                    lock.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:800;background:rgba(15,23,42,.95);border:1px solid rgba(248,113,113,.4);color:#f87171;letter-spacing:.3px;"><i class="fas fa-lock"></i>${label}</span>`;
                    // Ensure parent is positioned
                    const pos = window.getComputedStyle(el).position;
                    if (pos === 'static') el.style.position = 'relative';
                    el.appendChild(lock);
                }
            }
        });
    }

    function _lockLabel(needed, access) {
        if (!access?.hasSub)  return 'Subscription Required';
        if (!access?.teamId)  return 'Team Required';
        if (needed === 'staff' || needed === 'captain') return 'Captains Only';
        return 'Locked';
    }

    return { check, require, showBanner, applyHubGates, LEVELS };
})();
