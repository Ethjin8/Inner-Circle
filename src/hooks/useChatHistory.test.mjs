import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChatPath, makeThread } from './useChatHistoryHelpers.js';

test('buildChatPath returns the expected per-user path segments', () => {
  assert.deepEqual(buildChatPath('uid-123'), ['users', 'uid-123', 'chats']);
});

test('makeThread builds a thread with id, createdAt, and a truncated title', () => {
  const t = makeThread({
    messages: [
      { role: 'user', content: 'help me plan a good gift for mom and dad for their anniversary in june please' },
    ],
    attachedNodeIds: ['1', '7'],
  });
  assert.ok(t.id);
  assert.ok(t.createdAt);
  assert.equal(t.attachedNodeIds.length, 2);
  assert.ok(t.title.length <= 60, 'title truncated to 60 chars');
  assert.ok(t.title.startsWith('help me plan'));
});

test('makeThread falls back to a generic title when no user message present', () => {
  const t = makeThread({ messages: [], attachedNodeIds: [] });
  assert.equal(t.title, 'New chat');
});
