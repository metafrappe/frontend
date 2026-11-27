import { Alert } from 'antd';
import { isReadOnly, useRoles } from '../access';
import { useCopy } from '../messages';
import { ModuleFrame, Section } from '../shared';
import { PlanSlot } from './PlanDetail';
export default function SitePlanPage() {
  const copy = useCopy();
  // Yardımcı roller bu sayfayı yalnız okur (G-168, G-170). Sunucu yazma isteğini yine reddeder.
  const readOnly = isReadOnly(useRoles());
  return (
    <ModuleFrame title={copy.sitePlan}>
      {readOnly && <Alert type="info" message={copy.readOnlySection} />}
      <Section title={copy.sites}>
        <p>{copy.sitesUnavailable}</p>
      </Section>
      <Section title={copy.plans}>
        {/* The server contract is not ready (AJA-1731, AJA-1732). No data yet: the slot shows the unavailable text. */}
        <PlanSlot plans={undefined} />
      </Section>
    </ModuleFrame>
  );
}
