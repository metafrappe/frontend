import { Alert, Button, Select } from 'antd';
import { Input } from '@/components/controls';
import { useCallback, useId, useState } from 'react';
import { isReadOnly, useRoles } from '../access';
import { parseExplanation } from '../contracts';
import { useRead } from '../data';
import { useCopy } from '../messages';
import { useModule } from '../context';
import { ModuleFrame, ResourceView, Section } from '../shared';
import PermissionLog from './PermissionLog';
import PermissionsAndRules from './PermissionsAndRules';
import RolesSection from './RoleMatrix';
import { UsersSection } from './Users';

type Permission = 'read' | 'write' | 'create' | 'delete' | 'submit' | 'cancel';
const operations: Permission[] = ['read', 'write', 'create', 'delete', 'submit', 'cancel'];
export default function AdministrationPage() {
  const env = useModule();
  const copy = useCopy();
  const id = useId();
  const [doctype, setDoctype] = useState('');
  const [name, setName] = useState('');
  const [ptype, setPtype] = useState<Permission>('read');
  const [query, setQuery] = useState<{ doctype: string; name: string; ptype: Permission }>();
  const explain = env?.client?.explainPermission;
  const load = useCallback(
    async (signal: AbortSignal) => parseExplanation(await (query && explain?.(query, { signal }))),
    [explain, query],
  );
  const read = useRead(query && explain ? load : null, JSON.stringify(query));
  // Yardımcı rol bu sayfada yalnız kullanıcılar bölümünü görür (G-168). Sunucu yine denetler.
  const readOnly = isReadOnly(useRoles());
  return (
    <ModuleFrame title={copy.administration}>
      <UsersSection />
      {readOnly ? (
        <Alert type="info" message={copy.usersOnly} />
      ) : (
        <>
          <Section title={copy.roles}>
            <RolesSection />
          </Section>
          <Section title={copy.permissionsAndRules}>
            <PermissionsAndRules />
          </Section>
          <Section title={copy.permissionLog}>
            <PermissionLog />
          </Section>
          <Section title={copy.explain}>
            <p>{copy.accessNote}</p>
            {!explain ? (
              <Alert type="info" message={copy.unavailable} />
            ) : (
              <form
                className="module-stack module-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (doctype.trim() && name.trim())
                    setQuery({ doctype: doctype.trim(), name: name.trim(), ptype });
                }}
              >
                <label htmlFor={`${id}-doctype`}>{copy.doctype}</label>
                <Input
                  id={`${id}-doctype`}
                  required
                  maxLength={140}
                  value={doctype}
                  onChange={(event) => setDoctype(event.target.value)}
                />
                <label htmlFor={`${id}-name`}>{copy.record}</label>
                <Input
                  id={`${id}-name`}
                  required
                  maxLength={140}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <label htmlFor={`${id}-operation`}>{copy.operation}</label>
                <Select<Permission>
                  id={`${id}-operation`}
                  value={ptype}
                  onChange={setPtype}
                  options={operations.map((value) => ({ value, label: copy[value] }))}
                />
                <Button htmlType="submit" type="primary" disabled={!doctype.trim() || !name.trim()}>
                  {copy.explain}
                </Button>
              </form>
            )}
            {query && (
              <ResourceView state={read.state} retry={read.refresh}>
                {(result) => (
                  <Section title={copy.accessResult}>
                    <Alert
                      type={result.allowed ? 'success' : 'warning'}
                      message={copy[result.reason]}
                    />
                    <dl>
                      <dt>{copy.record}</dt>
                      <dd>
                        {result.doctype}: {result.name}
                      </dd>
                      <dt>{copy.user}</dt>
                      <dd>{result.user}</dd>
                      <dt>{copy.operation}</dt>
                      <dd>{copy[result.ptype]}</dd>
                    </dl>
                    <Section title={copy.accessRules}>
                      {result.rules.length === 0 ? (
                        <p>{copy.empty}</p>
                      ) : (
                        <ul className="module-records">
                          {result.rules.map((rule) => (
                            <li key={rule.name}>
                              <p>{rule.title}</p>
                              <dl>
                                <dt>{copy.ruleRole}</dt>
                                <dd>{rule.role}</dd>
                                <dt>{copy.applies}</dt>
                                <dd>{rule.applies ? copy.yes : copy.no}</dd>
                                <dt>{copy.matches}</dt>
                                <dd>{rule.matches ? copy.yes : copy.no}</dd>
                              </dl>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Section>
                  </Section>
                )}
              </ResourceView>
            )}
          </Section>
        </>
      )}
    </ModuleFrame>
  );
}
