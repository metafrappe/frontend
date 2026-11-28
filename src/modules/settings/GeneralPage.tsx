import { TENANT_SETTINGS_DOCTYPE } from './doctypes';
import { SettingsRecord } from './SettingsRecord';

export default function GeneralPage() {
  return <SettingsRecord doctype={TENANT_SETTINGS_DOCTYPE} title="general" />;
}
