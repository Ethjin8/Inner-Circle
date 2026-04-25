import { useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

// Real-time subcollection: users/{uid}/people/{personId}
// Each person doc stores everything except `id` (Firestore doc ID = person ID).
export function usePeople() {
  const { user } = useAuth();
  const [people, setPeople]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setPeople([]); setLoading(false); return; }
    setLoading(true);
    const ref = collection(db, 'users', user.uid, 'people');
    return onSnapshot(ref, (snap) => {
      setPeople(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

  const personRef = (id) => doc(db, 'users', user.uid, 'people', id);

  const addPerson = async (person) => {
    if (!user) return;
    const { id, ...rest } = person;
    await setDoc(personRef(id), rest);
  };

  const updatePerson = async (person) => {
    if (!user) return;
    const { id, ...rest } = person;
    await updateDoc(personRef(id), rest);
  };

  const removePeople = async (ids) => {
    if (!user || ids.length === 0) return;
    const batch = writeBatch(db);
    ids.forEach((id) => batch.delete(personRef(id)));
    await batch.commit();
  };

  const restorePeople = async (peopleToRestore) => {
    if (!user || peopleToRestore.length === 0) return;
    const batch = writeBatch(db);
    peopleToRestore.forEach((p) => {
      const { id, ...rest } = p;
      batch.set(personRef(id), rest);
    });
    await batch.commit();
  };

  return { people, loading, addPerson, updatePerson, removePeople, restorePeople };
}
