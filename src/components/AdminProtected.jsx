import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import SkeletonState from './SkeletonState';
import { useStaffAccess } from '../lib/staffAccess';

export { STAFF_ROLES, isStaffRole } from '../lib/roles';

export default function AdminProtected({ children }) {
  const { pathname } = useLocation();
  const access = useStaffAccess(pathname);

  if (access.status === 'checking') {
    return (
      <main className="protected-loading" aria-busy="true">
        <SkeletonState label="Verifying staff authorization" variant="profile" />
      </main>
    );
  }

  if (access.status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (access.status === 'denied') {
    return <Navigate to="/dashboard" replace />;
  }

  if (access.status !== 'allowed') {
    return (
      <main className="protected-loading" role="alert">
        <p>{access.error || 'Staff access could not be verified.'}</p>
        <button type="button" onClick={access.retry}>Try again</button>
        <Link to="/dashboard">Return to dashboard</Link>
      </main>
    );
  }

  return (
    <React.Fragment key={access.session?.user?.id || 'admin-protected'}>
      {children}
    </React.Fragment>
  );
}
