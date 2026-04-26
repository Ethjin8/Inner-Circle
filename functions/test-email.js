require('dotenv').config();
const nodemailer = require("nodemailer");

// Mocking the data structure you use in Firestore
const demoPerson1 = {
  name: "Eric",
  birthday: "2007-11-20",
  relationship: {
    type: "friend",
    strength: 92
  },
  context: {
    location: "Bay Area, CA",
    work: "Senior Software Engineer",
    hobbies: ["running", "golf", "eating good food"]
  },
  history: {
    memories_together: [
      "Teaching me how to build my first PC",
      "Hiking Torrey Pines together every Christmas morning"
    ],
    shared_milestones: []
  }
};

const demoPerson2 = {
  name: "Alex",
  birthday: "2006-11-20",
  relationship: {
    type: "friend",
    strength: 92
  },
  context: {
    location: "Bay Area, CA",
    work: "Senior Software Engineer",
    hobbies: ["running", "golf", "eating good food"]
  },
  history: {
    memories_together: [
      "Teaching me how to build my first PC",
      "Hiking Torrey Pines together every Christmas morning"
    ],
    shared_milestones: []
  }
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

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
`.trim();
}

async function testEmail1() {
  console.log("🚀 Starting test email send...");

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.error("❌ ERROR: GMAIL_USER or GMAIL_PASS is missing in functions/.env");
    return;
  }

  const message = `${demoPerson1.name}'s birthday is November, 20th get the presents ready!`;
  const refresher = formatRefresher(demoPerson1);

  try {
    await transporter.sendMail({
      from: `Inner Circle <${process.env.GMAIL_USER}>`,
      to: 'alexxiao@g.ucla.edu',
      subject: `Reconnecting: ${demoPerson1.name}`,
      text: `You haven't talked to ${demoPerson1.name} in a while. You should shoot them a text.\n\n${refresher}`,
    });
    console.log("✅ SUCCESS: Test email sent to recipient");
  } catch (err) {
    console.error("❌ FAILED:", err.message);
  }
}

async function testEmail2() {
  console.log("🚀 Starting test email send...");

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.error("❌ ERROR: GMAIL_USER or GMAIL_PASS is missing in functions/.env");
    return;
  }

  const message = `${demoPerson2.name}'s birthday is November, 20th get the presents ready!`;
  const refresher = formatRefresher(demoPerson2);

  try {
    await transporter.sendMail({
      from: `Inner Circle <${process.env.GMAIL_USER}>`,
      to: 'ericle@ucla.edu',
      subject: `Reconnecting: ${demoPerson2.name}`,
      text: `You haven't talked to ${demoPerson2.name} in a while. You should shoot them a text.\n\n${refresher}`,
    });
    console.log("✅ SUCCESS: Test email sent to recipient");
  } catch (err) {
    console.error("❌ FAILED:", err.message);
  }
}

testEmail1();
testEmail2();
