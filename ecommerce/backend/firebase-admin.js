
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

let serviceAccount;

// Use environment variable on Render
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Use local JSON file during development
  serviceAccount = require("./firebase-service-account.json");
}

// Prevent Firebase from initializing multiple times
const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      });

const adminAuth = getAuth(app);

module.exports = adminAuth;
