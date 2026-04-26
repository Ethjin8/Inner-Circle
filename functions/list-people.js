const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("../serviceAccount.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const UID = "nK6FTTdBKIddUQYKq2thXtoaORs2"; // eric.tanh.le@gmail.com

(async () => {
  const snap = await db.collection("users").doc(UID).collection("people").get();
  console.log(`People count: ${snap.size}`);
  snap.forEach(doc => {
    const p = doc.data();
    console.log(`- ${p.name || doc.id} | birthday=${p.birthday || "-"} | lastContactAt=${p.lastContactAt || "-"}`);
  });
})();
