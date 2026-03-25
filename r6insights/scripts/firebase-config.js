/**
 * R6 Insights — Shared Firebase Configuration
 * ─────────────────────────────────────────────
 * This file is loaded by every page before any page-level scripts.
 * Pages call: firebase.initializeApp(FIREBASE_CONFIG)
 *
 * NOTE: Firebase web API keys are inherently public — they identify
 * your project to Firebase, not authenticate it. Access control is
 * enforced by Firebase Security Rules in the Firebase Console.
 */

const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyBRrm0ZrKfhrBWa7A0VghOz82ufJvHeJqI",
    authDomain:        "r6stattracker.firebaseapp.com",
    databaseURL:       "https://r6stattracker-default-rtdb.firebaseio.com",
    projectId:         "r6stattracker",
    storageBucket:     "r6stattracker.appspot.com",
    messagingSenderId: "575541861129",
    appId:             "1:575541861129:web:28682f4fc01279e46651d8",
    measurementId:     "G-TN7LJDJP3R"
};
