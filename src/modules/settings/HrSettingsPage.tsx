import { HR_SETTINGS_DOCTYPE } from './doctypes';
import { SettingsRecord } from './SettingsRecord';

export default function HrSettingsPage() {
  return <SettingsRecord doctype={HR_SETTINGS_DOCTYPE} title="hr" />;
}
