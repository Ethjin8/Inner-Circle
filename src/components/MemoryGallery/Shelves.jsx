import { useMemo, useState } from 'react';
import { AdvancedImage } from '@cloudinary/react';
import { Cloudinary } from '@cloudinary/url-gen';
import { fill } from '@cloudinary/url-gen/actions/resize';
import { autoGravity } from '@cloudinary/url-gen/qualifiers/gravity';
import PhotoZoomModal from './PhotoZoomModal';
import './Shelves.css';

export default function Shelves({ photosByPerson = {}, people = [] }) {
  const [zoom, setZoom] = useState(null); // { photo, personName }

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const cld = useMemo(() => {
    if (!cloudName || cloudName === 'your_cloud_name_here') return null;
    return new Cloudinary({ cloud: { cloudName } });
  }, [cloudName]);

  const peopleById = useMemo(() => {
    const map = new Map();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

  const rows = useMemo(() => {
    const built = [];
    for (const [personId, list] of Object.entries(photosByPerson)) {
      if (!list || list.length === 0) continue;
      const person = peopleById.get(personId);
      if (!person) continue;
      const sorted = [...list].sort(
        (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
      );
      built.push({ person, photos: sorted });
    }
    built.sort((a, b) =>
      a.person.name.toLowerCase().localeCompare(b.person.name.toLowerCase())
    );
    return built;
  }, [photosByPerson, peopleById]);

  if (rows.length === 0) {
    return (
      <div className="shelves-empty-state">
        <h2>Your Memory Gallery</h2>
        <p>Open a person's card and upload photos to see them here.</p>
      </div>
    );
  }

  return (
    <div className="shelves-scroll">
      <div className="shelves-list">
        {rows.map(({ person, photos }) => (
          <section key={person.id} className="shelf-row">
            <header className="shelf-header">
              <h3 className="shelf-name">{person.name}</h3>
              <span className="shelf-count">
                {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
              </span>
            </header>
            <div className="shelf-strip">
              {photos.map((photo) => {
                const tile = cld
                  ? cld.image(photo.public_id).resize(
                      fill().width(360).height(480).gravity(autoGravity())
                    )
                  : null;
                return (
                  <button
                    key={photo.public_id}
                    className="shelf-tile"
                    onClick={() => setZoom({ photo, personName: person.name })}
                    title={person.name}
                  >
                    {tile ? (
                      <AdvancedImage cldImg={tile} className="shelf-tile-img" />
                    ) : (
                      <img src={photo.secure_url} className="shelf-tile-img" alt={person.name} />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {zoom && (
        <PhotoZoomModal
          photo={zoom.photo}
          personName={zoom.personName}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  );
}
