import React from 'react';
import { getProfileProgress } from '../lib/profileCompletion';
import './admin-profile-context.css';

const ASSESSMENT_LABELS = {
  service: 'Requested services',
  situation: 'Current situation',
  urgency: 'Timing',
  materials: 'Existing materials',
  activity: 'Job search activity',
  budget: 'Budget range',
  readiness: 'Readiness'
};

function displayValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value ? String(value) : '';
}

export default function AdminProfileContext({ profile }) {
  if (!profile) return null;
  const progress = getProfileProgress(profile);
  const answers = profile.lead_assessment?.answers || {};
  const score = profile.lead_score != null && Number.isFinite(Number(profile.lead_score)) ? profile.lead_score : null;

  const details = [
    ['Target role', profile.target_role],
    ['Experience', profile.experience],
    ['Education', profile.education],
    ['Skills', profile.skills],
    ['Certifications', profile.certifications],
    ['Location', profile.location],
    ['Bio', profile.bio],
    ['LinkedIn', profile.linkedin, true],
    ['GitHub', profile.github, true],
    ['Portfolio', profile.portfolio, true]
  ];

  return (
    <section className="admin-profile-context" aria-label="Client professional profile">
      <header className="admin-profile-context-head">
        <div><span>CLIENT CONTEXT</span><h3>{profile.name || 'Professional profile'}</h3></div>
        <div className="admin-profile-readiness"><strong>{progress.percent}%</strong><span>core profile readiness</span></div>
      </header>
      <div className="admin-profile-context-grid">
        {details.map(([label, rawValue, link]) => {
          const value = displayValue(rawValue);
          return <div className="admin-profile-context-field" key={label}>
            <span>{label}</span>
            {value && link && /^https?:\/\//i.test(value)
              ? <a href={value} target="_blank" rel="noreferrer">{value}</a>
              : <p>{value || 'Not provided'}</p>}
          </div>;
        })}
      </div>
      <div className="admin-profile-assessment">
        <div className="admin-profile-assessment-title">
          <strong>Assessment</strong>
          <span>{profile.lead_status ? `${profile.lead_status} lead` : 'Not completed'}{score !== null ? ` · ${score} points` : ''}</span>
        </div>
        {Object.entries(ASSESSMENT_LABELS).some(([key]) => answers[key] != null) ? (
          <div className="admin-profile-assessment-grid">
            {Object.entries(ASSESSMENT_LABELS).filter(([key]) => answers[key] != null).map(([key, label]) => (
              <div key={key}><span>{label}</span><p>{displayValue(answers[key]).replace(/_/g, ' ')}</p></div>
            ))}
          </div>
        ) : <p className="admin-profile-assessment-empty">No assessment answers are available.</p>}
      </div>
    </section>
  );
}
