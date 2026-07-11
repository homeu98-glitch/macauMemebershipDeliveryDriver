import { NextResponse } from 'next/server';

import { createServiceRoleSupabaseClient } from '../../../../../lib/supabase';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { action?: 'suspend' | 'activate' | 'delete' } | null;
  const action = body?.action;

  if (!action || !['suspend', 'activate', 'delete'].includes(action)) {
    return NextResponse.json({ message: '缺少有效操作。' }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data: driver, error: driverError } = await supabase
      .from('driver_profiles')
      .select('id,auth_user_id,approval_status')
      .eq('id', id)
      .maybeSingle();

    if (driverError || !driver) {
      return NextResponse.json({ message: '找不到對應騎手。' }, { status: 404 });
    }

    if (action === 'suspend') {
      const { error } = await supabase
        .from('driver_profiles')
        .update({ approval_status: 'suspended', availability: 'offline' })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'activate') {
      const { error } = await supabase
        .from('driver_profiles')
        .update({ approval_status: 'approved', availability: 'offline' })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    const { data: docs } = await supabase
      .from('driver_documents')
      .select('storage_path')
      .eq('driver_id', id);

    const storagePaths = (docs ?? []).map((doc) => doc.storage_path).filter(Boolean) as string[];
    if (storagePaths.length > 0) {
      await supabase.storage.from('driver-documents').remove(storagePaths);
    }
    await supabase.from('driver_documents').delete().eq('driver_id', id);

    if (driver.auth_user_id) {
      const authResult = await supabase.auth.admin.deleteUser(driver.auth_user_id);
      if (authResult.error) throw authResult.error;
      return NextResponse.json({ success: true });
    }

    const { error: deleteProfileError } = await supabase.from('driver_profiles').delete().eq('id', id);
    if (deleteProfileError) throw deleteProfileError;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '騎手管理操作失敗。' },
      { status: 500 },
    );
  }
}
