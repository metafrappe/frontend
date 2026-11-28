import { TENANT_BRANDING_DOCTYPE } from './doctypes';
import { SettingsRecord } from './SettingsRecord';

export default function BrandingPage() {
  return <SettingsRecord doctype={TENANT_BRANDING_DOCTYPE} title="branding" />;
}
