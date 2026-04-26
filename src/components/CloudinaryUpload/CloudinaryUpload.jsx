import { useState, useCallback, useMemo } from 'react';
import { AdvancedImage } from '@cloudinary/react';
import { Cloudinary } from "@cloudinary/url-gen";
import { fill, fit } from "@cloudinary/url-gen/actions/resize";
import { autoGravity } from "@cloudinary/url-gen/qualifiers/gravity";
import './CloudinaryUpload.css';

export default function CloudinaryUpload({ personId, photos = [], onPhotosChange }) {
  const [lightboxIdx, setLightboxIdx] = useState(null);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // Initialize Cloudinary instance
  const cld = useMemo(() => {
    if (!cloudName || cloudName === 'your_cloud_name_here') return null;
    return new Cloudinary({
      cloud: {
        cloudName: cloudName
      }
    });
  }, [cloudName]);

  const openWidget = useCallback(() => {
    if (!window.cloudinary) {
      console.error("Cloudinary widget script not loaded");
      return;
    }

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: cloudName,
        uploadPreset: uploadPreset,
        multiple: true,
        maxFiles: 10,
        sources: ['local', 'camera', 'url'],
        showAdvancedOptions: false,
        cropping: false,
        defaultSource: 'local',
        showPoweredBy: false,
        styles: {
          palette: {
            window:           '#0e0e0e',                  // --bg-deep
            windowBorder:     'rgba(255,255,255,0.10)',   // --border-default
            tabIcon:          '#e8e8f0',                  // --text-primary
            inactiveTabIcon:  '#55556a',                  // --text-muted
            menuIcons:        '#8a8a9a',                  // --text-secondary
            textLight:        '#e8e8f0',                  // --text-primary
            textDark:         '#0e0e0e',                  // text on cyan action btn
            link:             '#7df9ff',                  // --accent
            action:           '#7df9ff',                  // --accent
            inProgress:       '#7df9ff',                  // --accent
            complete:         '#5fd496',                  // --celestial-coworker (green)
            error:            '#f06d6d',                  // --celestial-professional (coral)
            sourceBg:         '#0e0e0e',                  // --bg-deep
          },
          fonts: {
            default: null,
            "'Geist', sans-serif": {
              url: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap',
              active: true,
            },
          },
        },
      },
      (error, result) => {
        if (!error && result && result.event === "success") {
          const { public_id, secure_url, width, height } = result.info;
          const newPhoto = { public_id, secure_url, width, height, uploadedAt: new Date().toISOString() };
          onPhotosChange?.([...photos, newPhoto]);
        }
      }
    );

    widget.open();
  }, [cloudName, uploadPreset, photos, onPhotosChange]);

  const handleDelete = useCallback((publicId) => {
    onPhotosChange?.(photos.filter(p => p.public_id !== publicId));
  }, [photos, onPhotosChange]);

  const prev = () => setLightboxIdx(i => (i - 1 + photos.length) % photos.length);
  const next = () => setLightboxIdx(i => (i + 1) % photos.length);

  if (!cld) {
    return (
      <div className="cld-setup-notice">
        <span>📷</span>
        <p>Add your Cloudinary credentials to <code>.env</code> to enable photo uploads.<br />
          Set <code>VITE_CLOUDINARY_CLOUD_NAME</code> and <code>VITE_CLOUDINARY_UPLOAD_PRESET</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="cld-container">
      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="cld-grid">
          {photos.map((photo, idx) => {
            const thumbImg = cld.image(photo.public_id)
              .resize(fill().width(160).height(160).gravity(autoGravity()));

            return (
              <div key={photo.public_id} className="cld-thumb-wrap" onClick={() => setLightboxIdx(idx)}>
                <AdvancedImage cldImg={thumbImg} className="cld-thumb" />
                <button
                  className="cld-thumb-del"
                  onClick={(e) => { e.stopPropagation(); handleDelete(photo.public_id); }}
                  title="Remove photo"
                >×</button>
              </div>
            );
          })}
          <button className="cld-add-btn" onClick={openWidget} title="Add more photos">
            <span>+</span>
          </button>
        </div>
      )}

      {/* Empty state upload button */}
      {photos.length === 0 && (
        <button className="cld-upload-btn" onClick={openWidget}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload Photos
        </button>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="cld-lightbox" onClick={() => setLightboxIdx(null)}>
          <div className="cld-lightbox-inner" onClick={e => e.stopPropagation()}>
            <button className="cld-lb-close" onClick={() => setLightboxIdx(null)}>×</button>
            {photos.length > 1 && (
              <button className="cld-lb-nav cld-lb-prev" onClick={prev}>‹</button>
            )}
            <AdvancedImage 
              cldImg={cld.image(photos[lightboxIdx]?.public_id).resize(fit().width(900).height(700))} 
              className="cld-lb-img" 
            />
            {photos.length > 1 && (
              <button className="cld-lb-nav cld-lb-next" onClick={next}>›</button>
            )}
            <div className="cld-lb-count">{lightboxIdx + 1} / {photos.length}</div>
          </div>
        </div>
      )}
    </div>
  );
}


