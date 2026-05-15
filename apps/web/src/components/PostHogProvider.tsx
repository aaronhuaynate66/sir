'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

export default function PostHogProvider({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail?: string;
}) {
  useEffect(() => {
    const key = process.env['NEXT_PUBLIC_POSTHOG_KEY'];
    if (!key) return;
    posthog.init(key, {
      api_host:        'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: true,
      autocapture:     false,
    });
    posthog.identify(userId, { ...(userEmail ? { email: userEmail } : {}) });
  }, [userId, userEmail]);

  return null;
}
