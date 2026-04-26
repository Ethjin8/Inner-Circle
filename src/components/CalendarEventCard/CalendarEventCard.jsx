import { useState } from 'react';
import './CalendarEventCard.css';

/**
 * Generates a .ics file string from event data
 */
function generateICS({ title, description, startDate, endDate, location }) {
  const formatDate = (iso) => {
    // Convert ISO string to ICS format: 20260428T100000Z
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace('.000', '');
  };

  const uid = `inner-circle-${Date.now()}@localapp`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Inner Circle//AI Relationship Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDate(new Date().toISOString())}`,
    `DTSTART:${formatDate(startDate)}`,
    `DTEND:${formatDate(endDate)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    location ? `LOCATION:${location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

/**
 * Format a date nicely for display
 */
function formatDisplay(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * CalendarEventCard
 * Props:
 *   event    — { title, description, startDate, endDate, location, attendeeName }
 *   onClose  — called when dismissed
 */
export default function CalendarEventCard({ event, onClose }) {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    const icsContent = generateICS(event);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloaded(true);
  };

  const handleAddToGoogleCalendar = () => {
    // Build a Google Calendar "quick add" URL
    const start = new Date(event.startDate).toISOString().replace(/[-:]/g, '').replace('.000', '');
    const end = new Date(event.endDate).toISOString().replace(/[-:]/g, '').replace('.000', '');
    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', event.title);
    url.searchParams.set('dates', `${start}/${end}`);
    url.searchParams.set('details', event.description);
    if (event.location) url.searchParams.set('location', event.location);
    window.open(url.toString(), '_blank');
  };

  return (
    <div className="cal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cal-card">
        {/* Header */}
        <div className="cal-header">
          <div className="cal-header-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Calendar Event</span>
          </div>
          <button className="cal-close" onClick={onClose}>×</button>
        </div>

        {/* Event Details */}
        <div className="cal-body">
          <div className="cal-title">{event.title}</div>

          <div className="cal-meta-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>{formatDisplay(event.startDate)}</span>
          </div>

          {event.location && (
            <div className="cal-meta-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span>{event.location}</span>
            </div>
          )}

          {event.attendeeName && (
            <div className="cal-meta-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <span>With {event.attendeeName}</span>
            </div>
          )}

          <div className="cal-description">{event.description}</div>
        </div>

        {/* Footer */}
        <div className="cal-footer">
          {downloaded && (
            <span className="cal-success">✓ .ics downloaded — open it to add to your calendar!</span>
          )}

          <div className="cal-actions">
            <button className="cal-btn-ghost" onClick={handleDownload}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download .ics
            </button>
            <button className="cal-btn-primary" onClick={handleAddToGoogleCalendar}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Add to Google Calendar ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
