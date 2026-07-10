import { NextResponse } from 'next/server';

import { createServiceRoleSupabaseClient } from '../../../../../../lib/supabase';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: 'approved' | 'rejected'; note?: string } | null;
  const status = body?.status;
  const note = body?.note?.trim() ?? '';

  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ message: '缺少有效的審核結果。' }, { status: 400 });
  }

  if (status === 'rejected' && !note) {
    return NextResponse.json({ message: '退回申請時必須填寫原因。' }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data: application, error: applicationError } = await supabase
      .from('driver_applications')
      .select('id,driver_id')
      .eq('id', id)
      .maybeSingle();

    if (applicationError || !application) {
      return NextResponse.json({ message: '找不到對應的騎手申請。' }, { status: 404 });
    }

    const { data: docs } = await supabase
      .from('driver_documents')
      .select('id,storage_path')
      .eq('driver_id', application.driver_id);

    const reviewedAt = new Date().toISOString();
    const reviewNote = note || (status === 'approved' ? '資料審核通過。' : '資料未通過審核。');

    const { error: updateApplicationError } = await supabase
      .from('driver_applications')
      .update({ review_status: status, review_note: reviewNote, reviewed_at: reviewedAt })
      .eq('id', id);
    if (updateApplicationError) throw updateApplicationError;

    const { error: updateDriverError } = await supabase
      .from('driver_profiles')
      .update({ approval_status: status === 'approved' ? 'approved' : 'rejected' })
      .eq('id', application.driver_id);
    if (updateDriverError) throw updateDriverError;

    const storagePaths = (docs ?? []).map((doc) => doc.storage_path).filter(Boolean) as string[];
    if (storagePaths.length > 0) {
      await supabase.storage.from('driver-documents').remove(storagePaths);
    }
    await supabase.from('driver_documents').delete().eq('driver_id', application.driver_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '更新騎手審核失敗。' },
      { status: 500 },
    );
  }
}
