import { google } from 'googleapis';

/**
 * Create a Gmail API client authenticated with the user's access token.
 * The token comes from Firebase's Google sign-in (passed from the frontend).
 */
function getGmailClient(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

/**
 * Build a raw RFC 2822 email and base64url-encode it for the Gmail API.
 */
function buildRawEmail({ to, subject, body }) {
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');

  return Buffer.from(email).toString('base64url');
}

/**
 * Create a Gmail draft and return the draft ID and shareable link.
 */
export async function createGmailDraft(accessToken, { to, subject, body }) {
  const gmail = getGmailClient(accessToken);
  const raw = buildRawEmail({ to, subject, body });

  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw },
    },
  });

  const draftId = res.data.id;
  const draftLink = `https://mail.google.com/mail/#drafts/${draftId}`;
  return { draftId, draftLink };
}

/**
 * Send an existing Gmail draft by its ID.
 */
export async function sendGmailDraft(accessToken, draftId) {
  const gmail = getGmailClient(accessToken);
  const res = await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: draftId },
  });
  return res.data;
}

/**
 * Update an existing draft (e.g., if user edits the body/subject in the UI).
 */
export async function updateGmailDraft(accessToken, draftId, { to, subject, body }) {
  const gmail = getGmailClient(accessToken);
  const raw = buildRawEmail({ to, subject, body });
  const res = await gmail.users.drafts.update({
    userId: 'me',
    id: draftId,
    requestBody: {
      message: { raw },
    },
  });
  return res.data;
}
