import { getSupabaseClient } from '../supabase';
import type {
  DbNotificationLog,
  InsertNotificationLog,
  NotificationType,
} from '../schema';

export async function createNotificationLog(
  data: InsertNotificationLog
): Promise<DbNotificationLog> {
  const { data: log, error } = await getSupabaseClient()
    .from('notification_logs')
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(`createNotificationLog: ${error.message}`);
  return log as DbNotificationLog;
}

export async function getNotificationLogs(
  userId: string,
  limit = 50
): Promise<DbNotificationLog[]> {
  const { data, error } = await getSupabaseClient()
    .from('notification_logs')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getNotificationLogs: ${error.message}`);
  return (data ?? []) as DbNotificationLog[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('notification_logs')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`markNotificationRead: ${error.message}`);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from('notification_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'read');
  if (error) throw new Error(`getUnreadNotificationCount: ${error.message}`);
  return count ?? 0;
}

export async function getDailyNotificationCount(userId: string): Promise<number> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { count, error } = await getSupabaseClient()
    .from('notification_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', dayStart.toISOString())
    .in('status', ['sent', 'pending']);
  if (error) throw new Error(`getDailyNotificationCount: ${error.message}`);
  return count ?? 0;
}

export async function getRecentByType(
  userId: string,
  type: NotificationType,
  withinHours: number
): Promise<DbNotificationLog[]> {
  const since = new Date(Date.now() - withinHours * 3_600_000).toISOString();
  const { data, error } = await getSupabaseClient()
    .from('notification_logs')
    .select()
    .eq('user_id', userId)
    .eq('type', type)
    .gte('created_at', since);
  if (error) throw new Error(`getRecentByType: ${error.message}`);
  return (data ?? []) as DbNotificationLog[];
}

export async function updatePushToken(userId: string, token: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('users')
    .update({ expo_push_token: token })
    .eq('id', userId);
  if (error) throw new Error(`updatePushToken: ${error.message}`);
}
