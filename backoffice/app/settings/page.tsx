import { SettingsOverview } from '../../components/backoffice';
import { LegalSettingsPanel } from '../../components/legal-settings-panel';
import { getSettings, isSupabaseConfigured } from '../../lib/data';

export default function SettingsPage() {
  return (
    <div className="stack gap-6">
      <SettingsOverview
        settings={getSettings()}
        supabaseConfigured={isSupabaseConfigured()}
      />
      <LegalSettingsPanel />
    </div>
  );
}
