'use client';
// The thin strip at the top of every page: Sign in with Google, or "Hi Name" and Sign out.
import { useEffect, useState } from 'react';
import { getSupabase } from './supabase';

export default function AuthBar() {
  const [state, setState] = useState({ ready: false, user: null });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return; // not set up on this machine: show nothing
    // Called once now with the current sign in, and again whenever it changes.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ ready: true, user: session?.user ?? null });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!state.ready) return null;

  const signIn = () => getSupabase().auth.signInWithOAuth({
    provider: 'google',
    // Come back to the page the learner is on right now.
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  const signOut = () => getSupabase().auth.signOut();

  const meta = state.user?.user_metadata ?? {};
  const firstName = (meta.full_name ?? meta.name ?? '').split(' ')[0] || 'there';

  return (
    <div className="authbar">
      <div className="authbar-inner">
        {state.user ? (
          <>
            <span>Hi {firstName}. Your trades are saved to your account.</span>
            <button type="button" onClick={signOut}>Sign out</button>
          </>
        ) : (
          <>
            <span>Sign in to keep your portfolio on any device.</span>
            <button type="button" onClick={signIn}>Sign in with Google</button>
          </>
        )}
      </div>
    </div>
  );
}
