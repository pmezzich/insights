
/**
 * autoscore_from_teams.js
 * Robust scoreboard calculator that uses per-round score *deltas*,
 * ignoring the unreliable `won` booleans that sometimes mark both
 * teams as winners for bomb‑defuse endings.
 *
 * Drop this file at: docs/r6tracker/scripts/autoscore_from_teams.js
 * It exposes a single function on window: updateScoreFromRounds(allRounds).
 * FinalVersion.html should call it after each successful parse.
 */
(function () {
  const NAMESPACE = "[autoscore v3]";

  function dbg(...args) {
    try { console.log(NAMESPACE, ...args); } catch (_) {}
  }

  /**
   * Try to resolve the team objects in many possible shapes coming from the parser.
   * Returns: { your, opp } or null if not found.
   */
  function resolveTeamsBlock(round) {
    // Most reliable: "header.teams" with score/startingScore
    if (round && round.header && Array.isArray(round.header.teams) && round.header.teams.length >= 2) {
      return { your: round.header.teams[0], opp: round.header.teams[1] };
    }
    // Sometimes raw lives here
    if (round && round.header && round.header.raw && Array.isArray(round.header.raw.teams) && round.header.raw.teams.length >= 2) {
      return { your: round.header.raw.teams[0], opp: round.header.raw.teams[1] };
    }
    // Fallback: a top-level "teams"
    if (round && Array.isArray(round.teams) && round.teams.length >= 2) {
      return { your: round.teams[0], opp: round.teams[1] };
    }
    return null;
  }

  /**
   * Compute the outcome by comparing after vs. before scores.
   * We *ignore* any boolean "won" flags due to known UBISOFT header quirks.
   *
   * Returns: { win: boolean, yourAfter: number, oppAfter: number }
   */
  function computeOutcomeFromDelta(round, lastYour = 0, lastOpp = 0) {
    const teams = resolveTeamsBlock(round);
    // If we cannot find a teams block, we cannot compute; treat as no-op.
    if (!teams) {
      dbg("no teams block on round; keeping last", { lastYour, lastOpp });
      return { win: false, yourAfter: lastYour, oppAfter: lastOpp, uncertain: true };
    }

    const yourBefore = Number.isFinite(teams.your?.startingScore) ? Number(teams.your.startingScore) : lastYour;
    const oppBefore  = Number.isFinite(teams.opp?.startingScore)  ? Number(teams.opp.startingScore)  : lastOpp;

    const yourAfter = Number.isFinite(teams.your?.score) ? Number(teams.your.score) : yourBefore;
    const oppAfter  = Number.isFinite(teams.opp?.score)  ? Number(teams.opp.score)  : oppBefore;

    const win = yourAfter > yourBefore && oppAfter === oppBefore
             || yourAfter === yourBefore && oppAfter < oppBefore     // safety if headers were swapped
             || (yourAfter - yourBefore) > (oppAfter - oppBefore);   // final tie‑breaker

    dbg("round delta", {
      yourBefore, yourAfter, oppBefore, oppAfter, win,
      roundNumber: round?.header?.roundNumber ?? round?.roundNumber
    });

    return { win, yourAfter, oppAfter };
  }

  /**
   * Public: updateScoreFromRounds(allRounds)
   * allRounds: array of parsed round objects (in any order). We’ll sort by roundNumber if present.
   */
  function updateScoreFromRounds(allRounds) {
    if (!Array.isArray(allRounds) || allRounds.length === 0) return;

    // Sort by round number if available to make deltas consistent
    const rounds = [...allRounds].sort((a, b) => {
      const ar = a?.header?.roundNumber ?? a?.roundNumber ?? 0;
      const br = b?.header?.roundNumber ?? b?.roundNumber ?? 0;
      return ar - br;
    });

    let yourScore = 0;
    let oppScore  = 0;

    // Store a pretty, per‑round result for the UI tiles
    const perRound = [];

    for (const r of rounds) {
      const { win, yourAfter, oppAfter } = computeOutcomeFromDelta(r, yourScore, oppScore);

      // Apply outcome using the delta between after & our current tallies.
      // If headers are perfect, this is idempotent.
      const yDelta = Math.max(0, Number(yourAfter) - Number(yourScore));
      const oDelta = Math.max(0, Number(oppAfter)  - Number(oppScore));

      if (yDelta === 0 && oDelta === 0) {
        // Fall back: if nothing advanced, trust 'win' boolean from our delta logic
        if (win) yourScore++; else oppScore++;
      } else {
        yourScore += yDelta;
        oppScore  += oDelta;
      }

      perRound.push({ win: yDelta > 0 || (yDelta === 0 && oDelta === 0 && win),
                      yourScore, oppScore,
                      roundNumber: r?.header?.roundNumber ?? r?.roundNumber });
    }

    // Update UI (if FinalVersion.html provides these)
    try {
      const yourScoreEl = document.getElementById('yourScore');
      const oppScoreEl  = document.getElementById('opponentScore');
      const finalScoreEl = document.getElementById('finalScoreText');
      if (yourScoreEl) yourScoreEl.textContent = yourScore;
      if (oppScoreEl)  oppScoreEl.textContent  = oppScore;
      if (finalScoreEl) finalScoreEl.textContent = `${yourScore} - ${oppScore}`;
    } catch (_) {}

    // Paint the round tiles if present
    try {
      const tiles = document.querySelectorAll('.round-tile');
      perRound.forEach((r, i) => {
        const tile = tiles[i];
        if (!tile) return;
        tile.classList.remove('bg-red-700', 'bg-emerald-700');
        tile.classList.add(r.win ? 'bg-emerald-700' : 'bg-red-700');
      });
    } catch (_) {}

    // Expose for debugging
    window.__autoscore = { yourScore, oppScore, perRound };
    dbg("score set", { yourScore, oppScore, perRound });
  }

  // Export
  window.updateScoreFromRounds = updateScoreFromRounds;
})();
