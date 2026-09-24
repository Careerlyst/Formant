import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; // File structure onujayi path

export default function ResendLink({ email }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const handleResend = async () => {
    if (!email) return;
    setIsLoading(true);
    setMessage({ text: "", type: "" });

    const { error } = await supabase.auth.resend({
      type: 'signup', // Confirmation link er jonno[cite: 2]
      email: email,
    });

    if (error) {
      setMessage({ text: error.message, type: "error" });
    } else {
      setMessage({ text: "Confirmation link resent successfully!", type: "success" });
      setCanResend(false);
      setTimeLeft(30);
    }
    setIsLoading(false);
  };

  return (
    <div style={{ marginTop: 'var(--space-6, 24px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', fontSize: 'var(--font-body-sm, 12px)', fontFamily: "'DM Sans', sans-serif", color: 'var(--muted, #6d7069)' }}>
        <span>Didn't receive the link?</span>

        {canResend ? (
          <button
            onClick={handleResend}
            disabled={isLoading}
            style={{
              padding: '4px 12px',
              borderRadius: '2px', // Careerlyst app shell button radius[cite: 3]
              border: '1px solid var(--line, #deded5)', // Thin border[cite: 3]
              background: 'var(--paper, #fff)',
              color: 'var(--ink, #11120f)',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: 'none', // No elevation for basic panels[cite: 3]
              transition: 'background 180ms ease'
            }}
          >
            {isLoading ? "Sending..." : "Resend Link"}
          </button>
        ) : (
          <span>
            Resend in <strong style={{ color: 'var(--ink, #11120f)' }}>{timeLeft}s</strong>
          </span>
        )}
      </div>

      {message.text && (
        <p style={{
          marginTop: 'var(--space-2, 8px)',
          fontSize: 'var(--font-sm, 11px)', // Compact metadata size[cite: 3]
          color: message.type === 'error' ? 'var(--danger, #b94a48)' : 'var(--green, #8fb61c)',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          {message.text}
        </p>
      )}
    </div>
  );
}