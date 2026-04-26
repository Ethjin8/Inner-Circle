import { useEffect, useRef, useState, useMemo } from 'react';
import { AdvancedImage } from '@cloudinary/react';
import { Cloudinary } from "@cloudinary/url-gen";
import { fit } from "@cloudinary/url-gen/actions/resize";
import { Trash2 } from 'lucide-react';
import Shelves from '../MemoryGallery/Shelves';
import PhotoZoomModal from '../MemoryGallery/PhotoZoomModal';
import { confirmDialog } from '../ConfirmDialog/ConfirmDialog';
import './MemoryCarousel.css';

const VIEW_MODE_KEY = 'gallery-view-mode';

const DRAG_SENSITIVITY = 0.005;
const WHEEL_SENSITIVITY = 0.002;
const LERP_FACTOR = 0.08;
const AUTO_PLAY_SPEED = 0.002;

export default function MemoryCarousel({ photos = [], onClose, photosByPerson = {}, people = [], onDeletePhoto }) {
  const [mode, setMode] = useState(() => {
    if (typeof window === 'undefined') return 'album';
    return window.localStorage.getItem(VIEW_MODE_KEY) === 'shelves' ? 'shelves' : 'album';
  });

  const setViewMode = (next) => {
    setMode(next);
    try { window.localStorage.setItem(VIEW_MODE_KEY, next); } catch {}
  };

  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const animRef = useRef(null);
  const didDrag = useRef(false);

  const [zoomPhoto, setZoomPhoto] = useState(null);
  
  // Physics state
  const targetOffset = useRef(0);
  const currentOffset = useRef(0);
  const isDragging = useRef(false);
  const startMouseX = useRef(0);
  const startTargetOffset = useRef(0);
  const lastInteractionTime = useRef(Date.now());

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  
  const cld = useMemo(() => {
    if (!cloudName || cloudName === 'your_cloud_name_here') return null;
    return new Cloudinary({ cloud: { cloudName } });
  }, [cloudName]);

  useEffect(() => {
    if (mode !== 'album') return;
    if (photos.length === 0) return;

    const renderLoop = () => {
      const now = Date.now();
      
      // Auto-play if idle for 3 seconds
      if (!isDragging.current && now - lastInteractionTime.current > 3000) {
        targetOffset.current += AUTO_PLAY_SPEED;
      }

      // Clamp target offset between 0 and max index (with some bounce room)
      const maxOffset = Math.max(0, photos.length - 1);
      if (!isDragging.current) {
        if (targetOffset.current < 0) targetOffset.current += (0 - targetOffset.current) * 0.1;
        if (targetOffset.current > maxOffset) targetOffset.current += (maxOffset - targetOffset.current) * 0.1;
      }

      // Lerp current towards target
      currentOffset.current += (targetOffset.current - currentOffset.current) * LERP_FACTOR;

      // Apply 3D transforms to DOM children
      if (trackRef.current) {
        const cards = trackRef.current.children;
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          const relativeOffset = i - currentOffset.current;
          const absOffset = Math.abs(relativeOffset);
          const sign = Math.sign(relativeOffset);

          // Coverflow math
          // Transform X: push items away from center
          const tx = relativeOffset * 550; // pixels apart
          
          // Rotate Y: side items turn away
          const ry = sign * Math.min(absOffset * 50, 65);
          
          // Translate Z: push side items back in 3D space
          const tz = -Math.abs(relativeOffset) * 250;
          
          // Blur side items
          const blur = Math.max(0, (absOffset - 0.5) * 4);
          
          // Opacity fades out items far away
          const opacity = Math.max(0, 1 - (absOffset * 0.3));

          card.style.transform = `translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg)`;
          card.style.filter = `blur(${blur}px)`;
          card.style.opacity = opacity;
          card.style.zIndex = Math.round(100 - absOffset * 10);
        }
      }

      animRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => cancelAnimationFrame(animRef.current);
  }, [photos.length, mode]);

  const handlePointerDown = (e) => {
    isDragging.current = true;
    didDrag.current = false;
    startMouseX.current = e.clientX || e.touches?.[0]?.clientX || 0;
    startTargetOffset.current = targetOffset.current;
    lastInteractionTime.current = Date.now();
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const deltaX = clientX - startMouseX.current;
    if (Math.abs(deltaX) > 5) didDrag.current = true;
    // Moving left (negative delta) moves camera right (positive offset)
    targetOffset.current = startTargetOffset.current - deltaX * DRAG_SENSITIVITY;
    lastInteractionTime.current = Date.now();
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    // Snap to nearest integer when let go
    targetOffset.current = Math.round(targetOffset.current);
    lastInteractionTime.current = Date.now();
  };

  const handleWheel = (e) => {
    // Wheel deltaX (horizontal trackpad scroll) or deltaY (mouse wheel)
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    targetOffset.current += delta * WHEEL_SENSITIVITY;
    lastInteractionTime.current = Date.now();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      lastInteractionTime.current = Date.now();
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (mode !== 'album') return;
      if (e.key === 'ArrowRight') {
        targetOffset.current = Math.min(photos.length - 1, Math.round(targetOffset.current) + 1);
      } else if (e.key === 'ArrowLeft') {
        targetOffset.current = Math.max(0, Math.round(targetOffset.current) - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos.length, onClose, mode]);

  const isAlbum = mode === 'album';

  return (
    <div
      className="memory-carousel-overlay"
      ref={containerRef}
      onPointerDown={isAlbum ? handlePointerDown : undefined}
      onPointerMove={isAlbum ? handlePointerMove : undefined}
      onPointerUp={isAlbum ? handlePointerUp : undefined}
      onPointerLeave={isAlbum ? handlePointerUp : undefined}
      onWheel={isAlbum ? handleWheel : undefined}
    >
      <div className="gallery-mode-toggle" role="tablist" aria-label="Gallery view">
        <button
          role="tab"
          aria-selected={isAlbum}
          className={`gallery-mode-btn ${isAlbum ? 'active' : ''}`}
          onClick={() => setViewMode('album')}
        >
          Album
        </button>
        <button
          role="tab"
          aria-selected={!isAlbum}
          className={`gallery-mode-btn ${!isAlbum ? 'active' : ''}`}
          onClick={() => setViewMode('shelves')}
        >
          Shelves
        </button>
      </div>

      <button className="carousel-close" onClick={onClose} title="Close (Esc)">✕</button>

      {isAlbum ? (
        photos.length === 0 ? (
          <div className="carousel-empty-state">
            <h2>Your Memory Gallery</h2>
            <p>Open a person's card and upload photos to see them here.</p>
          </div>
        ) : (
          <div className="carousel-track" ref={trackRef}>
            {photos.map((photo, i) => (
              <div
                key={`${photo.public_id}-${i}`}
                className="carousel-item"
                // Use pointerUp instead of click: the lerp animation can shift
                // a card out from under the cursor between mousedown and
                // mouseup, which makes the browser fire `click` on the common
                // ancestor (the track) rather than the card.
                onPointerUp={(e) => {
                  if (didDrag.current) return;
                  if (e.target.closest('.carousel-item-delete')) return;
                  setZoomPhoto(photo);
                  lastInteractionTime.current = Date.now();
                }}
                style={{ cursor: 'pointer' }}
              >
                {cld ? (
                  <AdvancedImage
                    cldImg={cld.image(photo.public_id).resize(fit().width(1200).height(1200))}
                    alt={`Memory with ${photo.personName}`}
                  />
                ) : (
                  <img src={photo.secure_url} alt={`Memory with ${photo.personName}`} />
                )}
                {onDeletePhoto && (
                  <button
                    type="button"
                    className="carousel-item-delete"
                    aria-label={`Delete photo of ${photo.personName}`}
                    title="Delete photo"
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirmDialog({
                        title: 'Delete photo?',
                        message: `This photo of ${photo.personName} will be removed.`,
                        confirmLabel: 'Delete',
                      });
                      if (ok) onDeletePhoto(photo);
                    }}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
                <div className="carousel-caption">
                  <h3>{photo.personName}</h3>
                  <p>{new Date(photo.uploadedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <Shelves photosByPerson={photosByPerson} people={people} />
      )}

      {zoomPhoto && (
        <PhotoZoomModal
          photo={zoomPhoto}
          personName={zoomPhoto.personName}
          onClose={() => setZoomPhoto(null)}
        />
      )}
    </div>
  );
}
