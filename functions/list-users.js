const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const serviceAccount = require("../serviceAccount.json");

initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();

async function list() {
  const users = await auth.listUsers();
  users.users.forEach(u => console.log(`${u.email} -> ${u.uid}`));
}

list();
