'use client';
import React, { useEffect, useRef, useState } from 'react';

// Google reCAPTCHA v2 checkbox. Uses the official TEST site key, which
// always passes verification in testing; real keys are configured later.
// The widget is only a spam check — if the script cannot load, or the
// backend verify endpoint is not deployed yet, registration continues in
// test mode (the login page logs a console warning instead of blocking).
export const RECAPTCHA_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

declare global {
  interface Window { grecaptcha?: any; __qicCaptchaOnload?: () => void }
}

export function Captcha({ onToken, resetKey = 0 }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.grecaptcha || !ref.current) return;
      try {
        widgetId.current = window.grecaptcha.render(ref.current, {
          sitekey: RECAPTCHA_SITE_KEY,
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      } catch {
        setFailed(true);
      }
    };
    if (window.grecaptcha) {
      render();
      return () => { cancelled = true; };
    }
    window.__qicCaptchaOnload = () => render();
    if (!document.querySelector('script[src*="recaptcha/api.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?onload=__qicCaptchaOnload&render=explicit';
      s.async = true;
      s.defer = true;
      s.onerror = () => {
        if (!cancelled) {
          setFailed(true);
          console.warn('[captcha] reCAPTCHA script failed to load — continuing in test mode');
        }
      };
      document.head.appendChild(s);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parent bumps resetKey after a failed server verification so the user
  // gets a fresh checkbox to solve.
  useEffect(() => {
    if (resetKey > 0 && widgetId.current !== null && window.grecaptcha) {
      try { window.grecaptcha.reset(widgetId.current); } catch { /* ignore */ }
      onToken(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (failed) {
    return <p className="text-xs text-muted">Captcha could not be loaded — continuing in test mode.</p>;
  }
  return <div>
    <div ref={ref} />
    <p className="mt-1 text-xs text-muted">This check helps stop spam accounts.</p>
  </div>;
}
