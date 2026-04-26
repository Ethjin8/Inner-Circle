import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { buildChatPath, makeThread } from './useChatHistoryHelpers';

// Real-time subcollection: users/{uid}/chats/{chatId}
// Each chat doc stores { title, createdAt, messages, attachedNodeIds }.

export { buildChatPath, makeThread };

export function useChatHistory() {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);

  useEffect(() => {
    if (!user) { setThreads([]); return; }
    const ref = collection(db, ...buildChatPath(user.uid));
    return onSnapshot(ref, (snap) => {
      const next = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setThreads(next);
    });
  }, [user]);

  const chatRef = (id) => doc(db, ...buildChatPath(user.uid), id);

  const addThread = async (thread) => {
    if (!user) return;
    const { id, ...rest } = thread;
    await setDoc(chatRef(id), rest);
  };

  const deleteThread = async (id) => {
    if (!user) return;
    await deleteDoc(chatRef(id));
  };

  const getThread = (id) => threads.find((t) => t.id === id) ?? null;

  return { threads, addThread, deleteThread, getThread };
}
