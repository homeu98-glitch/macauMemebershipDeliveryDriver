import { SettingsOverview } from "../../components/backoffice";
import { getSettings, isSupabaseConfigured } from "../../lib/data";

export default function SettingsPage() {
  return (
    <SettingsOverview
      settings={getSettings()}
      supabaseConfigured={isSupabaseConfigured()}
    />
  );
}
