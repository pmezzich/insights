// matchreplay.js

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBRrm0ZrKfhrBWa7A0VghOz82ufJvHeJqI",
  authDomain: "r6stattracker.firebaseapp.com",
  databaseURL: "https://r6stattracker-default-rtdb.firebaseio.com",
  projectId: "r6stattracker",
  storageBucket: "r6stattracker.appspot.com",
  messagingSenderId: "575541861129",
  appId: "1:575541861129:web:28682f4fc01279e46651d8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let currentUser = null;
let currentTeamId = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) return (window.location.href = "index.html");
  currentUser = user;
  const snap = await db.ref(`users/${user.uid}/teamId`).once("value");
  currentTeamId = snap.val();
});

// Handle replay upload form
const form = document.getElementById("replayUploadForm");
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById("replayFile");
  const opponentInput = document.getElementById("opponent");

  const files = fileInput.files;
  const opponent = opponentInput.value.trim();
  if (!files.length || !opponent || !currentTeamId) {
    return showToast("Missing fields", false);
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("replays", file);
  }

  try {
    const res = await fetch("http://localhost:8080/analyze-replay", {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error("Failed to analyze replay");

    const data = await res.json();
    const matchRef = db.ref(`teams/${currentTeamId}/matches`).push();

    const firstRound = data["R01"] || Object.values(data)[0];
    const map = firstRound?.map?.name || "Unknown";
    const timestamp = firstRound?.timestamp || new Date().toISOString();

    const matchMeta = {
      opponent,
      map,
      timestamp,
      uploadedBy: currentUser.uid
    };

    await matchRef.set(matchMeta);

    for (const roundKey of Object.keys(data)) {
      const round = data[roundKey];
      const roundData = {
        site: round.site,
        roundNumber: roundKey,
        timestamp: round.timestamp,
        events: round.matchFeedback || [],
        players: round.players || []
      };
      await matchRef.child("rounds").child(roundKey).set(roundData);
    }

    showToast("Match saved to Firebase ✅", true);
    document.getElementById("resultsSection").classList.remove("hidden");
    document.getElementById("roundTimeline").textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    console.error(err);
    showToast("Error: " + err.message, false);
  }
});

function showToast(message, success = true) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${success ? "success" : "error"}`;
  toast.style.display = "flex";
  setTimeout(() => (toast.style.display = "none"), 4000);
}

