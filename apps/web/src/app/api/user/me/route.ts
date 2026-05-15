import { getUserFromRequest, AuthError } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: Request): Promise<Response> {
  try {
    const userId = await getUserFromRequest(req);
    const db     = getServiceClient();

    const raw  = await req.json().catch(() => ({})) as unknown;
    const body = raw as { confirm?: unknown };

    if (body.confirm !== true) {
      return Response.json(
        { error: 'Envía { "confirm": true } para confirmar la eliminación permanente de tu cuenta y todos sus datos.' },
        { status: 400 },
      );
    }

    // Audit log before deletion (will cascade-delete with user record)
    // Write to audit_log first, then delete
    await db.from('audit_log').insert({
      user_id:  userId,
      action:   'delete_account',
      metadata: { requested_at: new Date().toISOString() },
    });

    // Delete public.users — cascades to people, memories, signals, briefings, relationships, etc.
    await db.from('users').delete().eq('id', userId);

    // Delete from auth.users
    const { error: authError } = await db.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('[DELETE /api/user/me] auth.admin.deleteUser failed:', authError);
    }

    return Response.json({ message: 'Cuenta eliminada. Todos tus datos han sido borrados permanentemente.' });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message, code: err.code }, { status: 401 });
    }
    console.error('[DELETE /api/user/me]', err);
    return Response.json({ error: 'Error al eliminar la cuenta' }, { status: 500 });
  }
}
