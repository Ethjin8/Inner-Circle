import { useCallback, useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, writeBatch,
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

  // Each callback is keyed on `user` so consumers that memoize them with
  // [updatePerson] etc. as deps automatically pick up the post-sign-in version
  // — without this, callers that wrap these in their own useCallback with
  // empty deps would silently keep the pre-auth (user=null) closure forever
  // and writes would throw "Not signed in" even after sign-in.
  const personRef = useCallback(
    (id) => doc(db, 'users', user.uid, 'people', id),
    [user],
  );

  const addPerson = useCallback(async (person) => {
    if (!user) return;
    const { id, ...rest } = person;
    await setDoc(personRef(id), rest);
  }, [user, personRef]);

  const updatePerson = useCallback(async (person) => {
    if (!user) throw new Error('Not signed in — cannot save changes.');
    if (!person?.id) throw new Error('Cannot save: person has no id.');
    const { id, ...rest } = person;
    await setDoc(personRef(id), rest, { merge: true });
  }, [user, personRef]);

  const removePeople = useCallback(async (ids) => {
    if (!user || ids.length === 0) return;
    const batch = writeBatch(db);
    ids.forEach((id) => batch.delete(personRef(id)));
    await batch.commit();
  }, [user, personRef]);

  const restorePeople = useCallback(async (peopleToRestore) => {
    if (!user || peopleToRestore.length === 0) return;
    const batch = writeBatch(db);
    peopleToRestore.forEach((p) => {
      const { id, ...rest } = p;
      batch.set(personRef(id), rest);
    });
    await batch.commit();
  }, [user, personRef]);

  return { people, setPeople, loading, addPerson, updatePerson, removePeople, restorePeople };
}
