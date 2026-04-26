const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const serviceAccount = require("../serviceAccount.json");

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

async function cleanupGlobal() {
  try {
    const listUsersResult = await auth.listUsers();
    for (const user of listUsersResult.users) {
      console.log(`Cleaning up: ${user.email}`);
      // Remove the global test person from every user's private folder
      await db.collection('users').doc(user.uid).collection('people').doc('global-demo-test').delete();
      await db.collection('users').doc(user.uid).collection('people').doc('demo-birthday-test').delete();
    }
    console.log("✅ Cleanup complete. All demo people removed.");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

cleanupGlobal();
