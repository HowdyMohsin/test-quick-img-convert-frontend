'use client';
import React, { useEffect, useState } from 'react';
import { Header, AnnouncementBar, useMe } from './Header';
import { Footer } from './Footer';
import { ConsentBar } from './ConsentBar';
import { ExitPopup } from './Popups';
import { usePathname } from 'next/navigation';

const NO_CHROME_POPUP = ['/login', '/account', '/forgot-password', '/reset-password', '/verify-email', '/privacy-policy', '/terms'];

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const { me, loaded, refresh } = useMe();
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState<string | null>(null);
  // Re-fetch the session on navigation: after a login the header must
  // show the signed-in state on the very next page, not keep the stale
  // logged-out links from the previous page.
  useEffect(() => { refresh(); }, [pathname, refresh]);
  useEffect(() => {
    fetch('/api/v1/site', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.announcement?.text && d.announcement.enabled !== false) setAnnouncement(d.announcement.text); })
      .catch(() => {});
  }, []);
  const showExit = (pathname === '/' || pathname === '/pricing') && !NO_CHROME_POPUP.includes(pathname);
  return <>
    <AnnouncementBar text={announcement} />
    <Header me={me} loaded={loaded} onSignOut={refresh} />
    <main className="min-h-[60vh]">{children}</main>
    <Footer />
    <ConsentBar />
    {showExit && <ExitPopup />}
  </>;
}
