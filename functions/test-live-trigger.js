const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const nodemailer = require("nodemailer");
const serviceAccount = require("../serviceAccount.json");
require('dotenv').config({ path: './functions/.env' });

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

async function runLiveTest() {
  const now = new Date();
  const todayMMDD = now.toISOString().slice(5, 10); // Expecting "04-26"
  console.log(`\n--- 🔍 DEBUG START: ${now.toLocaleString()} ---`);
  console.log(`Targeting Birthday MMDD: "${todayMMDD}"`);

  try {
    const listUsersResult = await auth.listUsers();
    console.log(`Found ${listUsersResult.users.length} total users in Auth.`);

    for (const user of listUsersResult.users) {
      console.log(`\nChecking User: ${user.email} (UID: ${user.uid})`);

      const peopleRef = db.collection('users').doc(user.uid).collection('people');
      const snapshot = await peopleRef.get();

      console.log(`-> Found ${snapshot.size} people in this user's collection.`);

      const nudges = [];
      snapshot.forEach(doc => {
        const person = doc.data();
        const pId = doc.id;
        const pBday = person.birthday || "NONE";

        console.log(`   - Person: "${person.name}" (ID: ${pId}) | Bday: "${pBday}"`);

        // Check Birthday
        if (person.birthday && person.birthday.slice(5, 10) === todayMMDD) {
          console.log(`     ✅ MATCH FOUND!`);
          nudges.push({
            message: `It is ${person.name}'s birthday!!! Don't forget to let them know.`,
            name: person.name
          });
        }
      });

      if (nudges.length > 0) {
        console.log(`   🚀 PREPARING EMAIL FOR ${user.email} with ${nudges.length} nudges...`);
        const emailBody = nudges.map(n => `📢 ${n.message}`).join('\n\n');

        try {
          await transporter.sendMail({
            from: `Inner Circle Debug <${process.env.GMAIL_USER}>`,
            to: user.email,
            subject: `Daily Inner Circle Pulse: ${nudges.length} updates`,
            text: `This is a live test for your birthday reminders.\n\n${emailBody}`
          });
          console.log(`   ✅ EMAIL SENT SUCCESSFULLY TO ${user.email}`);
        } catch (mailErr) {
          console.error(`   ❌ MAIL SEND FAILED:`, mailErr.message);
        }
      } else {
        console.log(`   ℹ️ No nudges triggered for this user.`);
      }
    }
    console.log(`\n--- 🏁 DEBUG COMPLETE ---`);
  } catch (err) {
    console.error(`\n❌ GLOBAL ERROR:`, err.message);
  }
}

runLiveTest();
