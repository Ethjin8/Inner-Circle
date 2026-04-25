import { useEffect, useRef, useState, useMemo } from 'react';
import { AdvancedImage } from '@cloudinary/react';
import { Cloudinary } from "@cloudinary/url-gen";
import { fit } from "@cloudinary/url-gen/actions/resize";
import './MemoryCarousel.css';

const DRAG_SENSITIVITY = 0.005;
const WHEEL_SENSITIVITY = 0.002;
const LERP_FACTOR = 0.08;
const AUTO_PLAY_SPEED = 0.002;

export default function MemoryCarousel({ photos = [], onClose }) {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const animRef = useRef(null);
  
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
  }, [photos.length]);

  const handlePointerDown = (e) => {
    isDragging.current = true;
    startMouseX.current = e.clientX || e.touches?.[0]?.clientX || 0;
    startTargetOffset.current = targetOffset.current;
    lastInteractionTime.current = Date.now();
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const deltaX = clientX - startMouseX.current;
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
      if (e.key === 'ArrowRight') {
        targetOffset.current = Math.min(photos.length - 1, Math.round(targetOffset.current) + 1);
      } else if (e.key === 'ArrowLeft') {
        targetOffset.current = Math.max(0, Math.round(targetOffset.current) - 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos.length, onClose]);

  return (
    <div 
      className="memory-carousel-overlay"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      <button className="carousel-close" onClick={onClose} title="Close (Esc)">✕</button>

      {photos.length === 0 ? (
        <div className="carousel-empty-state">
          <h2>Your Memory Gallery</h2>
          <p>Open a person's card and upload photos to see them here.</p>
        </div>
      ) : (
        <div className="carousel-track" ref={trackRef}>
          {photos.map((photo, i) => (
            <div key={`${photo.public_id}-${i}`} className="carousel-item">
              {cld ? (
                <AdvancedImage 
                  cldImg={cld.image(photo.public_id).resize(fit().width(1200).height(1200))}
                  alt={`Memory with ${photo.personName}`}
                />
              ) : (
                <img src={photo.secure_url} alt={`Memory with ${photo.personName}`} />
              )}
              <div className="carousel-caption">
                <h3>{photo.personName}</h3>
                <p>{new Date(photo.uploadedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
