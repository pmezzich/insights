/**
 * db-client.js  — R6 Insights
 *
 * Drop-in replacement for firebase-database-compat.js
 * Routes ALL Realtime Database reads/writes through the Cloudflare Worker
 * so no requests ever touch firebaseio.com directly (ad-blocker safe).
 *
 * Interface is identical to the Firebase compat SDK:
 *   const snap = await db.ref('teams/xyz').once('value');
 *   snap.val()  →  the data
 *   snap.key    →  last segment of path
 *   snap.exists() → true if data !== null
 *
 * USAGE — in every page, replace:
 *   <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-database-compat.js"></script>
 * with:
 *   <script src="../scripts/db-client.js"></script>
 *
 * Then remove any  firebase.database()  call; just use the global `db` object
 * which is created for you after firebase.auth() is available.
 *
 * Real-time listeners (.on('value', cb)) are implemented as polling every 5s.
 * Call  ref.off()  to stop polling.
 */

(function () {
  'use strict';

  const WORKER = 'https://wandering-butterfly-2324.pmezzich.workers.dev';

  // ── Get current user's ID token ───────────────────────────────────────────
  async function getToken() {
    const auth = firebase.auth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken(/* forceRefresh */ false);
  }

  // ── Snapshot wrapper — identical interface to Firebase DataSnapshot ────────
  class Snapshot {
    constructor(data, path) {
      this._data = data;
      this._path = path;
      this.key   = path ? path.split('/').filter(Boolean).pop() : null;
    }
    val()    { return this._data; }
    exists() { return this._data !== null && this._data !== undefined; }
    forEach(fn) {
      if (this._data && typeof this._data === 'object') {
        for (const [k, v] of Object.entries(this._data)) {
          fn(new Snapshot(v, `${this._path}/${k}`));
        }
      }
    }
  }

  // ── Ref class — mirrors firebase.database().ref(path) ─────────────────────
  class Ref {
    constructor(path) {
      this._path     = path.replace(/^\//, '');
      this._listeners = [];
      this._pollId   = null;
    }

    // child(segment) → new Ref
    child(segment) {
      return new Ref(`${this._path}/${segment}`);
    }

    // ── Reads ────────────────────────────────────────────────────────────────

    // once('value') → Promise<Snapshot>
    async once(event) {
      if (event !== 'value') throw new Error(`once('${event}') not supported`);
      const token = await getToken();
      const params = new URLSearchParams({ path: this._path });
      const res = await fetch(`${WORKER}/db?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`DB read failed (${res.status}): ${txt}`);
      }
      const { data } = await res.json();
      return new Snapshot(data, this._path);
    }

    // Alias: .get() === .once('value')
    get() { return this.once('value'); }

    // ── Real-time listener (polling every 5 s) ───────────────────────────────
    on(event, callback, errorCallback) {
      if (event !== 'value') return;
      const poll = async () => {
        try {
          const snap = await this.once('value');
          callback(snap);
        } catch (e) {
          if (errorCallback) errorCallback(e);
        }
      };
      poll(); // immediate first call
      this._pollId = setInterval(poll, 5000);
      this._listeners.push(callback);
    }

    off() {
      if (this._pollId) {
        clearInterval(this._pollId);
        this._pollId = null;
      }
      this._listeners = [];
    }

    // ── Writes ───────────────────────────────────────────────────────────────

    async set(data) {
      const token = await getToken();
      const res   = await fetch(`${WORKER}/db/set`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ path: this._path, data }),
      });
      if (!res.ok) throw new Error(`DB set failed (${res.status})`);
    }

    async update(data) {
      const token = await getToken();
      const res   = await fetch(`${WORKER}/db/update`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ path: this._path, data }),
      });
      if (!res.ok) throw new Error(`DB update failed (${res.status})`);
    }

    async remove() {
      const token = await getToken();
      const res   = await fetch(`${WORKER}/db/delete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ path: this._path }),
      });
      if (!res.ok) throw new Error(`DB delete failed (${res.status})`);
    }

    // push(data?)  → returns a ref-like object with .key and .set()
    // If data provided, writes immediately and resolves with the new ref.
    // If no data, returns a PushRef for chained .set()
    push(data) {
      const pushRef = new PushRef(this._path);
      if (data !== undefined) {
        // push + set in one call
        return pushRef._pushAndSet(data);
      }
      return pushRef;
    }
  }

  // ── PushRef — returned by .push() ─────────────────────────────────────────
  class PushRef {
    constructor(parentPath) {
      this._parentPath = parentPath;
      this.key         = null; // set after .set() resolves
    }

    async _pushAndSet(data) {
      const token = await getToken();
      const res   = await fetch(`${WORKER}/db/push`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ path: this._parentPath, data }),
      });
      if (!res.ok) throw new Error(`DB push failed (${res.status})`);
      const { key } = await res.json();
      this.key = key;
      return this;
    }

    async set(data) {
      return this._pushAndSet(data);
    }
  }

  // ── Database facade ────────────────────────────────────────────────────────
  class Database {
    ref(path = '/') {
      return new Ref(path);
    }
  }

  // ── Expose globally ────────────────────────────────────────────────────────
  // Replaces firebase.database() and also exposes a top-level `db` for convenience.
  const _db = new Database();

  // Patch firebase.database() so pages that call it still work
  if (typeof firebase !== 'undefined') {
    firebase.database = () => _db;
  }

  // Top-level shortcut used by most pages:  db.ref(path).once('value')
  window.db = _db;

  console.log('[db-client] Loaded — all DB calls proxied through Worker');
})();
