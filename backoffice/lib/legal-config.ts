import { createServiceRoleSupabaseClient } from './supabase';

export const LEGAL_CONFIG_KEYS = {
  disclaimer: 'driver_disclaimer',
  serviceTerms: 'driver_service_terms_privacy',
  version: 'driver_service_terms_version'
} as const;

export type LegalConfigRecord = {
  disclaimer: string;
  serviceTerms: string;
  version: string;
};

async function readConfigValue(key: string, fallback = '') {
  const supabase = createServiceRoleSupabaseClient();
  const { data } = await supabase
    .from('app_configs')
    .select('config_value')
    .eq('config_key', key)
    .maybeSingle();
  return typeof data?.config_value === 'string' ? data.config_value : fallback;
}

async function writeConfigValue(key: string, value: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from('app_configs').upsert({
    config_key: key,
    config_value: value,
    updated_at: new Date().toISOString()
  }, { onConflict: 'config_key' });
  if (error) throw error;
}

export async function getLegalConfig(): Promise<LegalConfigRecord> {
  const disclaimer = await readConfigValue(LEGAL_CONFIG_KEYS.disclaimer, '');
  const serviceTerms = await readConfigValue(LEGAL_CONFIG_KEYS.serviceTerms, '');
  const version = await readConfigValue(LEGAL_CONFIG_KEYS.version, '1');
  return { disclaimer, serviceTerms, version };
}

export async function saveLegalConfig(input: LegalConfigRecord) {
  await writeConfigValue(LEGAL_CONFIG_KEYS.disclaimer, input.disclaimer);
  await writeConfigValue(LEGAL_CONFIG_KEYS.serviceTerms, input.serviceTerms);
  await writeConfigValue(LEGAL_CONFIG_KEYS.version, input.version || '1');
}
