'use server';

import { revalidatePath } from 'next/cache';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';

export interface NotificationPrefs {
  push_enabled: boolean;
  email_enabled: boolean;
  dnd_start_hour: number;
  dnd_end_hour: number;
  max_notifs_per_day: number;
  timezone: string;
}

export async function updateNotificationPrefs(prefs: NotificationPrefs) {
  const user = await getAuthUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await getServiceClient()
    .from('users')
    .update({
      push_enabled:       prefs.push_enabled,
      email_enabled:      prefs.email_enabled,
      dnd_start_hour:     prefs.dnd_start_hour,
      dnd_end_hour:       prefs.dnd_end_hour,
      max_notifs_per_day: prefs.max_notifs_per_day,
      timezone:           prefs.timezone,
    })
    .eq('id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}
