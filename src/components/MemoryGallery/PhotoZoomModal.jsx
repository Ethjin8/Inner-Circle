import { useEffect, useMemo } from 'react';
import { AdvancedImage } from '@cloudinary/react';
import { Cloudinary } from '@cloudinary/url-gen';
import { fit } from '@cloudinary/url-gen/actions/resize';
import './PhotoZoomModal.css';

export default function PhotoZoomModal({ photo, personName, onClose }) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

  const cld = useMemo(() => {
    if (!cloudName || cloudName === 'your_cloud_name_here') return null;
    return new Cloudinary({ cloud: { cloudName } });
  }, [cloudName]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  if (!photo) return null;

  return (
    <div className="zoom-modal-backdrop" onClick={onClose}>
      <div className="zoom-modal-inner" onClick={(e) => e.stopPropagation()}>
        <button
          className="zoom-modal-close"
          onClick={onClose}
          title="Close"
          aria-label="Close"
        >
          ×
        </button>
        {cld ? (
          <AdvancedImage
            cldImg={cld.image(photo.public_id).resize(fit().width(900).height(700))}
            className="zoom-modal-img"
            alt={personName ? `Photo of ${personName}` : 'Photo'}
          />
        ) : (
          <img src={photo.secure_url} className="zoom-modal-img" alt={personName ? `Photo of ${personName}` : 'Photo'} />
        )}
        {personName && (
          <div className="zoom-modal-caption">{personName}</div>
        )}
      </div>
    </div>
  );
}
