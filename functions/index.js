const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const nodemailer = require("nodemailer");

initializeApp();
const db = getFirestore();
const auth = getAuth();

// Setup the email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

/**
 * Helper to format the "Refresher" section of the email
 */
function formatRefresher(person) {
  const rel = person.relationship || {};
  const ctx = person.context || {};
  const hist = person.history || {};

  return `
--- RELATIONSHIP REFRESHER ---
• Role: ${rel.type || 'Unknown'} (Strength: ${rel.strength || 0}%)
• Location: ${ctx.location || 'Unknown'}
• Work: ${ctx.work || 'N/A'}
• Hobbies: ${(ctx.hobbies || []).join(', ')}
• Shared Memories:
  ${(hist.memories_together || []).map(m => `- ${m}`).join('\n  ')}
• Notable Milestones:
  ${(hist.shared_milestones || []).map(m => `- ${m}`).join('\n  ')}
`.trim();
}

/**
 * Scheduled function: Runs at 3:00 AM PDT
 */
exports.dailyNudge = onSchedule({
  schedule: "7 6 * * *",
  timeZone: "America/Los_Angeles"
}, async (event) => {
  const now = new Date();
  const todayMMDD = now.toISOString().slice(5, 10); // "MM-DD"
  
  console.log(`🚀 Starting Daily Nudge for ${now.toDateString()}...`);

  try {
    // 1. Get all users from Auth
    const listUsersResult = await auth.listUsers();
    const users = listUsersResult.users;

    for (const user of users) {
      console.log(`Checking nudges for user: ${user.email} (${user.uid})`);
      
      // 2. Fetch all people for this user
      const peopleRef = db.collection('users').doc(user.uid).collection('people');
      const snapshot = await peopleRef.get();
      
      if (snapshot.empty) continue;

      const nudges = [];

      snapshot.forEach(doc => {
        const person = { id: doc.id, ...doc.data() };
        
        // Scenario 1: Birthday Match
        if (person.birthday && person.birthday.slice(5, 10) === todayMMDD) {
          nudges.push({
            type: 'BIRTHDAY',
            name: person.name,
            message: `It is ${person.name}'s birthday!!! Don't forget to let them know.`,
            refresher: formatRefresher(person)
          });
        }

        // Scenario 2: Stale Connection (Multiple of 31 days)
        if (person.lastContactAt) {
          const lastDate = new Date(person.lastContactAt);
          const diffTime = Math.abs(now - lastDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays > 0 && diffDays % 31 === 0) {
            nudges.push({
              type: 'CATCHUP',
              name: person.name,
              message: `Have you talked to ${person.name} recently? Maybe y'all should catch up?`,
              refresher: formatRefresher(person)
            });
          }
        }
      });

      // 3. Send combined email if there are nudges
      if (nudges.length > 0) {
        console.log(`Found ${nudges.length} nudges for ${user.email}. Sending email...`);
        
        const emailBody = nudges.map(n => 
          `----------------------------------------------------\n` +
          `📢 ${n.message}\n` +
          `${n.refresher}\n`
        ).join('\n\n');

        const mailOptions = {
          from: 'Inner Circle <' + process.env.GMAIL_USER + '>',
          to: user.email,
          subject: `Daily Inner Circle Pulse: ${nudges.length} updates`,
          text: `Good morning! Here are your relationship nudges for today:\n\n${emailBody}`
        };

        await transporter.sendMail(mailOptions);
      }
    }

    console.log("✅ Daily Nudge completed successfully.");
  } catch (error) {
    console.error("❌ Error in dailyNudge:", error);
  }
});
