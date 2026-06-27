'use client';

import { useEffect, useRef, useState } from 'react';
import { Speaker, SpeakerFormData, SpeakerStatus } from '../../types/speaker';

interface SpeakerModalProps {
  mode: 'add' | 'edit';
  speaker?: Speaker;
  onSave: (data: SpeakerFormData) => void;
  onClose: () => void;
}

const EMPTY_FORM: SpeakerFormData = {
  name: '',
  email: '',
  bio: '',
  company: '',
  title: '',
  topic: '',
  status: 'pending',
  avatarUrl: '',
  sessionTime: '',
};

export function SpeakerModal({ mode, speaker, onSave, onClose }: SpeakerModalProps) {
  const [form, setForm] = useState<SpeakerFormData>(
    speaker ? { ...speaker } : { ...EMPTY_FORM }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof SpeakerFormData, string>>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.topic.trim()) errs.topic = 'Talk topic is required';
    if (!form.company.trim()) errs.company = 'Company is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSave(form);
  };

  const set = (field: keyof SpeakerFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'add' ? 'Add speaker' : 'Edit speaker'}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'add' ? 'Add Speaker' : 'Edit Speaker'}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            <div className="form-row">
              <Field label="Full Name" error={errors.name} required>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Dr. Amara Osei"
                  className={errors.name ? 'input error' : 'input'}
                />
              </Field>
              <Field label="Email" error={errors.email} required>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="speaker@company.com"
                  className={errors.email ? 'input error' : 'input'}
                />
              </Field>
            </div>

            <div className="form-row">
              <Field label="Company" error={errors.company} required>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => set('company', e.target.value)}
                  placeholder="Volta Labs"
                  className={errors.company ? 'input error' : 'input'}
                />
              </Field>
              <Field label="Job Title">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="Principal Engineer"
                  className="input"
                />
              </Field>
            </div>

            <Field label="Talk Topic" error={errors.topic} required>
              <input
                type="text"
                value={form.topic}
                onChange={(e) => set('topic', e.target.value)}
                placeholder="e.g. Consensus Without Compromise"
                className={errors.topic ? 'input error' : 'input'}
              />
            </Field>

            <Field label="Bio">
              <textarea
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="A short speaker bio visible to attendees…"
                rows={3}
                className="input textarea"
              />
            </Field>

            <div className="form-row">
              <Field label="Session Time">
                <input
                  type="text"
                  value={form.sessionTime ?? ''}
                  onChange={(e) => set('sessionTime', e.target.value)}
                  placeholder="Day 1 · 10:00 AM"
                  className="input"
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as SpeakerStatus)}
                  className="input select"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
            </div>

            <Field label="Avatar URL">
              <input
                type="url"
                value={form.avatarUrl ?? ''}
                onChange={(e) => set('avatarUrl', e.target.value)}
                placeholder="https://…"
                className="input"
              />
            </Field>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {mode === 'add' ? 'Add Speaker' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {label}
        {required && <span className="required-dot" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}