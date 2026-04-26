const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const serviceAccount = require("../serviceAccount.json");

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

async function setupDemo() {
  const targetEmail = process.argv[2]; // Get email from command line
  
  if (!targetEmail) {
    console.error("❌ Please provide your email: node setup-demo.js your-email@gmail.com");
    return;
  }

  try {
    const user = await auth.getUserByEmail(targetEmail);
    console.log(`Found user: ${user.uid}`);

    const testPerson = {
      name: "Demo Birthday Person",
      birthday: "2026-04-26", 
      relationship: { type: "friend", strength: 99 },
      context: { location: "LA Hacks", work: "Test Bot" },
      history: { memories_together: ["Private Test at 2:04 AM"] }
    };

    await db.collection('users').doc(user.uid).collection('people').doc('private-demo-test').set(testPerson);
    console.log(`✅ Successfully added demo to ${targetEmail} only.`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

setupDemo();
