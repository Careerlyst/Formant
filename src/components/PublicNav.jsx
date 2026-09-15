import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';


export default function PublicNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`header ${menuOpen ? 'menu-open' : ''}`}>
      <div className="nav">

        {/* Logo */}
        <Logo />

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          <Link to="/services">Services</Link>
          <a href="/#process">How it works</a>
          <Link to="/pricing">Pricing</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
        </nav>

        {/* Desktop Actions */}
        <div className="nav-actions">
          <Link className="pill lime nav-cta" to="/signup">
            Start your profile
            <span>↗</span>
          </Link>

          <Link className="login-link" to="/login">
            Log in
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span>
          <span></span>
        </button>

      </div>

      {/* Mobile Navigation */}
      <div className="mobile-nav">

        <nav className="mobile-nav-links">

          <Link to="/services" onClick={closeMenu}>
            <span>Services</span>
            <span>↗</span>
          </Link>

          <a href="/#process" onClick={closeMenu}>
            <span>How it works</span>
            <span>↗</span>
          </a>

          <Link to="/pricing" onClick={closeMenu}>
            <span>Pricing</span>
            <span>↗</span>
          </Link>

          <Link to="/about" onClick={closeMenu}>
            <span>About</span>
            <span>↗</span>
          </Link>

          <Link to="/contact" onClick={closeMenu}>
            <span>Contact</span>
            <span>↗</span>
          </Link>

        </nav>

        <div className="mobile-nav-footer">

          <Link
            className="mobile-profile-button"
            to="/signup"
            onClick={closeMenu}
          >
            Start your profile
            <span>↗</span>
          </Link>

          <p>
            Already have an account?{' '}
            <Link to="/login" onClick={closeMenu}>
              Log in
            </Link>
          </p>

        </div>

      </div>
    </header>
  );
}