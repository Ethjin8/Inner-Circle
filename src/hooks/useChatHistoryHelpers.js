// Pure helpers — no React, no Firebase, safe to import in Node tests.

export function buildChatPath(uid) {
  return ['users', uid, 'chats'];
}

export function makeThread({ messages, attachedNodeIds }) {
  const firstUser = (messages || []).find((m) => m.role === 'user');
  const raw = typeof firstUser?.content === 'string' ? firstUser.content : '';
  const title = raw.trim().slice(0, 60) || 'New chat';
  return {
    id: (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)),
    title,
    createdAt: new Date().toISOString(),
    messages: messages || [],
    attachedNodeIds: attachedNodeIds || [],
  };
}
