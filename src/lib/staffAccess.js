import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { createStaffAccessController } from './staffAccessController';

const INITIAL_ACCESS = { status: 'checking', session: null, error: '' };

export function useStaffAccess(refreshKey = '') {
  const [access, setAccess] = useState(INITIAL_ACCESS);
  const [retryVersion, setRetryVersion] = useState(0);
  const retry = useCallback(() => setRetryVersion((value) => value + 1), []);

  useEffect(() => {
    const controller = createStaffAccessController(supabase);
    const unsubscribe = controller.subscribe(setAccess);
    controller.start();

    return () => {
      unsubscribe();
      controller.stop();
    };
  }, [refreshKey, retryVersion]);

  return { ...access, retry };
}
