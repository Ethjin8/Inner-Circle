const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const serviceAccount = require("../serviceAccount.json");

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

async function setupGlobalDemo() {
  const testPerson = {
    name: "Demo Birthday Person",
    birthday: "2026-04-26", 
    relationship: { type: "friend", strength: 99 },
    context: { location: "LA Hacks", work: "Test Bot" },
    history: { memories_together: ["Global Demo Test at 2:00 AM"] }
  };

  try {
    const listUsersResult = await auth.listUsers();
    for (const user of listUsersResult.users) {
      console.log(`Adding demo to: ${user.email}`);
      await db.collection('users').doc(user.uid).collection('people').doc('global-demo-test').set(testPerson);
    }
    console.log("✅ Global Demo setup complete.");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

setupGlobalDemo();
