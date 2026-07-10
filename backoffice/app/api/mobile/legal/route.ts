import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV_PLACEHOLDERS } from '../../../../lib/data';
import { createServiceRoleSupabaseClient } from '../../../../lib/supabase';
import { getLegalConfig } from '../../../../lib/legal-config';

function createDriverUserClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

async function verifyAuthUser(accessToken: string) {
  const userClient = createDriverUserClient(accessToken);
  const { data, error } = await userClient.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return { authUserId: data.user.id };
}

export async function GET(request: Request) {
  const accessToken = request.headers.get('x-supabase-access-token')?.trim();
  if (!accessToken) {
    return NextResponse.json({ message: 'Missing x-supabase-access-token header.' }, { status: 401 });
  }

  const verified = await verifyAuthUser(accessToken);
  if (!verified) {
    return NextResponse.json({ message: 'Driver access verification failed.' }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const [config, profileResult] = await Promise.all([
      getLegalConfig(),
      supabase.from('driver_profiles').select('accepted_terms_version, accepted_terms_at').eq('id', verified.authUserId).maybeSingle()
    ]);

    return NextResponse.json({
      disclaimer: config.disclaimer,
      serviceTerms: config.serviceTerms,
      version: config.version,
      acceptedVersion: profileResult.data?.accepted_terms_version ?? null,
      acceptedAt: profileResult.data?.accepted_terms_at ?? null,
      mustAccept: (profileResult.data?.accepted_terms_version ?? null) !== config.version
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed to load legal docs.' }, { status: 500 });
  }
}
