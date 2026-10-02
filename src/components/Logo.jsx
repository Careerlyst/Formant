import React from 'react';
import { Link } from 'react-router-dom';

export default function Logo({ className = '', ...props }) {
  return (
    <Link
      to="/"
      className={`logo ${className}`.trim()}
      aria-label="Formant home"
      {...props}
    >
      <img
        src="/assets/formant-wordmark.svg"
        alt="Formant"
        className="logo-img"
      />
    </Link>
  );
}
