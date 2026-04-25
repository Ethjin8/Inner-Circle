import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

// Photo metadata is stored alongside people: users/{uid}/photos/{personId}
// Each doc holds { items: [ { public_id, secure_url, uploadedAt, ... } ] }.
// Cloudinary remains the source of truth for binary blobs.
export function usePhotos() {
  const { user } = useAuth();
  const [photosByPerson, setPhotosByPerson] = useState({});

  useEffect(() => {
    if (!user) { setPhotosByPerson({}); return; }
    const ref = collection(db, 'users', user.uid, 'photos');
    return onSnapshot(ref, (snap) => {
      const next = {};
      snap.docs.forEach((d) => { next[d.id] = d.data().items ?? []; });
      setPhotosByPerson(next);
    });
  }, [user]);

  const setPhotosForPerson = async (personId, items) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'photos', personId), { items });
  };

  return { photosByPerson, setPhotosForPerson };
}
