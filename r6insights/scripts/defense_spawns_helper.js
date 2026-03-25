/* defense_spawns_helper.js
 *
 * Extracts DEFENSE team operator spawns from a parsed round object.
 * Works with objects shaped like:
 *   parsed.header.players or parsed.players: [ { teamIndex, username, operator:{name}, spawn, roleName, ... } ]
 *   parsed.header.teams or parsed.teams:     [ { name: "YOUR TEAM"/"ENEMY TEAM", role: "Attack"/"Defense" }, ... ]
 *
 * API:
 *   const list = getDefenseSpawns(parsed);
 *   // list = [{username, operator, spawn, teamName, teamIndex}, ...]
 *
 * Optional DOM renderer:
 *   renderDefenseSpawns(list, {container: '#defense-spawns'});
 */

function _arr(x){ return Array.isArray(x) ? x : (x ? [x] : []); }
function _pickTeamRole(parsed, roleWanted){
  const teams = parsed?.processedData?.header?.teams || parsed?.header?.teams || parsed?.teams || [];
  if (!Array.isArray(teams) || teams.length < 2) return { index: null, name: null };
  const idx = teams.findIndex(t => String(t?.role||'').toLowerCase() === String(roleWanted||'').toLowerCase());
  const team = idx >= 0 ? teams[idx] : null;
  return { index: (idx>=0? idx : null), name: team?.name || null };
}

export function getDefenseSpawns(parsed){
  try{
    const players = parsed?.processedData?.header?.players || parsed?.header?.players || parsed?.players || [];
    const { index:defIdx, name:defName } = _pickTeamRole(parsed, 'Defense');
    if (!Array.isArray(players) || defIdx === null) return [];

    const out = [];
    for(const p of players){
      if (p?.teamIndex !== defIdx) continue;
      out.push({
        username: p?.username || p?.name || 'Unknown',
        operator: p?.operator?.name || p?.roleName || 'Unknown',
        spawn: p?.spawn || p?.objective || p?.siteName || 'Unknown',
        teamName: defName || 'Defense',
        teamIndex: defIdx
      });
    }
    // Stable order by operator then username
    out.sort((a,b)=> String(a.operator).localeCompare(String(b.operator)) || String(a.username).localeCompare(String(b.username)));
    return out;
  }catch(e){
    console.error('[getDefenseSpawns] failed', e);
    return [];
  }
}

export function renderDefenseSpawns(list, {container='#defense-spawns'}={}){
  const root = (typeof container === 'string') ? document.querySelector(container) : container;
  if (!root) return;
  // simple table
  const rows = list.map(p => `<tr><td>${escapeHtml(p.operator)}</td><td>${escapeHtml(p.username)}</td><td>${escapeHtml(p.spawn)}</td></tr>`).join('');
  root.innerHTML = `<table class="table-auto w-full text-sm"><thead><tr><th>Operator</th><th>Player</th><th>Spawn</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function escapeHtml(s){ return String(s).replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c])); }
