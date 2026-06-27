'use client';

import { Speaker } from '../../types/speaker';

interface SpeakerCardProps {
  speaker: Speaker;
  onEdit: (speaker: Speaker) => void;
  onDelete: (id: string) => void;
}

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', className: 'badge-confirmed' },
  pending:   { label: 'Pending',   className: 'badge-pending'   },
  cancelled: { label: 'Cancelled', className: 'badge-cancelled' },
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ');
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : parts[0].slice(0, 2);
  return <span className="avatar-initials">{initials.toUpperCase()}</span>;
}

export function SpeakerCard({ speaker, onEdit, onDelete }: SpeakerCardProps) {
  const status = STATUS_CONFIG[speaker.status];

  return (
    <article className="speaker-card">
      <div className="card-top">
        <div className="avatar">
          {speaker.avatarUrl ? (
            <img src={speaker.avatarUrl} alt={speaker.name} className="avatar-img" />
          ) : (
            <Initials name={speaker.name} />
          )}
        </div>
        <span className={`status-badge ${status.className}`}>{status.label}</span>
      </div>

      <div className="card-body">
        <h3 className="speaker-name">{speaker.name}</h3>
        <p className="speaker-role">{speaker.title} · {speaker.company}</p>
        <p className="speaker-topic">"{speaker.topic}"</p>
        {speaker.sessionTime && (
          <p className="speaker-time">
            <ClockIcon />
            {speaker.sessionTime}
          </p>
        )}
        {speaker.bio && <p className="speaker-bio">{speaker.bio}</p>}
      </div>

      <div className="card-actions">
        <button
          className="action-btn"
          onClick={() => onEdit(speaker)}
          aria-label={`Edit ${speaker.name}`}
        >
          <EditIcon /> Edit
        </button>
        <button
          className="action-btn action-btn--danger"
          onClick={() => onDelete(speaker.id)}
          aria-label={`Remove ${speaker.name}`}
        >
          <TrashIcon /> Remove
        </button>
      </div>
    </article>
  );
}

const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ display: 'inline', marginRight: 4 }}>
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 5v3.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M2 4h12M6 4V2h4v2M5 4l1 9h4l1-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);