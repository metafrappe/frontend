import { Alert, Button, Checkbox, ConfigProvider, Modal, Select, Switch, Tabs, theme } from 'antd';
import { Input } from '@/components/controls';
import { useCallback, useId, useState, type ReactNode } from 'react';
import { useModule } from '../context';
import { useMutation, useRead } from '../data';
import { useCopy } from '../messages';
import type { AdminClient } from '../runtime';
import {
  SCOPES,
  parseAccessRules,
  parseRoles,
  parseUserPermissions,
  type Scope,
  type UserPermissionEntry,
} from './contracts';
import { fill } from './format';
import { AdminResource } from './shared';
import './admin.css';

const RULE_OPERATIONS = ['read', 'write', 'create', 'delete', 'submit', 'cancel'] as const;

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="module-stack">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function UserPermissionForm({
  admin,
  close,
  saved,
}: {
  admin: AdminClient;
  close: () => void;
  saved: () => void;
}) {
  const copy = useCopy();
  const id = useId();
  const write = useMutation();
  const [user, setUser] = useState('');
  const [allow, setAllow] = useState('');
  const [forValue, setForValue] = useState('');
  const [applyAll, setApplyAll] = useState(true);
  const [applicableFor, setApplicableFor] = useState('');
  const [hideDescendants, setHideDescendants] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const ready =
    user.trim() && allow.trim() && forValue.trim() && (applyAll || applicableFor.trim());
  return (
    <form
      className="module-stack module-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        void write
          .run((signal) =>
            admin.createUserPermission(
              {
                user: user.trim(),
                allow: allow.trim(),
                for_value: forValue.trim(),
                apply_to_all_doctypes: applyAll ? 1 : 0,
                ...(applyAll ? {} : { applicable_for: applicableFor.trim() }),
                hide_descendants: hideDescendants ? 1 : 0,
                is_default: isDefault ? 1 : 0,
              },
              { signal },
            ),
          )
          .then((result) => {
            if (result !== undefined) saved();
          });
      }}
    >
      <Field id={`${id}-user`} label={copy.userField}>
        <Input
          id={`${id}-user`}
          required
          maxLength={140}
          value={user}
          onChange={(event) => setUser(event.target.value)}
        />
      </Field>
      <Field id={`${id}-allow`} label={copy.doctype}>
        <Input
          id={`${id}-allow`}
          required
          maxLength={140}
          value={allow}
          onChange={(event) => setAllow(event.target.value)}
        />
      </Field>
      <Field id={`${id}-value`} label={copy.permissionValue}>
        <Input
          id={`${id}-value`}
          required
          maxLength={140}
          value={forValue}
          onChange={(event) => setForValue(event.target.value)}
        />
      </Field>
      <div className="admin-switch">
        <Switch id={`${id}-all`} checked={applyAll} onChange={setApplyAll} />
        <label htmlFor={`${id}-all`}>{copy.applyAll}</label>
      </div>
      {!applyAll && (
        <Field id={`${id}-for`} label={copy.applicableFor}>
          <Input
            id={`${id}-for`}
            required
            maxLength={140}
            value={applicableFor}
            onChange={(event) => setApplicableFor(event.target.value)}
          />
        </Field>
      )}
      <div className="admin-switch">
        <Switch id={`${id}-hide`} checked={hideDescendants} onChange={setHideDescendants} />
        <label htmlFor={`${id}-hide`}>{copy.hideDescendants}</label>
      </div>
      <div className="admin-switch">
        <Switch id={`${id}-default`} checked={isDefault} onChange={setIsDefault} />
        <label htmlFor={`${id}-default`}>{copy.isDefault}</label>
      </div>
      {write.state.status === 'error' && (
        <Alert role="alert" type="error" message={copy[write.state.error]} />
      )}
      <div className="module-actions">
        <Button onClick={close}>{copy.formCancel}</Button>
        <Button
          type="primary"
          htmlType="submit"
          disabled={!ready}
          loading={write.state.status === 'pending'}
        >
          {copy.savePermission}
        </Button>
      </div>
    </form>
  );
}

function UserPermissions({ admin }: { admin: AdminClient }) {
  const copy = useCopy();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<UserPermissionEntry>();
  const [removeError, setRemoveError] = useState(false);
  const load = useCallback(
    async (signal: AbortSignal) =>
      parseUserPermissions(await admin.listUserPermissions({ signal })),
    [admin],
  );
  const read = useRead(load, 'user-permissions');
  async function remove() {
    if (!removing) return;
    try {
      await admin.deleteUserPermission(removing.name, {});
      setRemoving(undefined);
      read.refresh();
    } catch {
      setRemoveError(true);
    }
  }
  return (
    <div className="module-stack">
      <div className="module-actions">
        <Button type="primary" onClick={() => setAdding(true)}>
          {copy.addPermission}
        </Button>
      </div>
      <AdminResource state={read.state} retry={read.refresh}>
        {(list) =>
          list.length === 0 ? (
            <p>{copy.userPermissionsEmpty}</p>
          ) : (
            <ul className="module-records">
              {list.map((entry) => (
                <li key={entry.name} className="module-record">
                  <div>
                    <p>{entry.user}</p>
                    <p>
                      {entry.allow}: {entry.forValue}
                    </p>
                    <p>
                      {entry.applicableFor
                        ? fill(copy.onlyDoctype, { doctype: entry.applicableFor })
                        : copy.allDoctypes}
                    </p>
                  </div>
                  <Button danger onClick={() => (setRemoveError(false), setRemoving(entry))}>
                    {copy.remove}
                  </Button>
                </li>
              ))}
            </ul>
          )
        }
      </AdminResource>
      <Modal
        open={adding}
        title={copy.addPermission}
        footer={null}
        destroyOnHidden
        onCancel={() => setAdding(false)}
      >
        <UserPermissionForm
          admin={admin}
          close={() => setAdding(false)}
          saved={() => {
            setAdding(false);
            read.refresh();
          }}
        />
      </Modal>
      <Modal
        open={removing !== undefined}
        title={copy.removePermission}
        onCancel={() => setRemoving(undefined)}
        footer={[
          <Button key="cancel" onClick={() => setRemoving(undefined)}>
            {copy.formCancel}
          </Button>,
          <Button key="remove" danger type="primary" onClick={() => void remove()}>
            {copy.removePermission}
          </Button>,
        ]}
      >
        {removing && (
          <p>
            {fill(copy.removeConfirm, {
              user: removing.user,
              allow: removing.allow,
              value: removing.forValue,
            })}
          </p>
        )}
        {removeError && <Alert role="alert" type="error" message={copy.uncertain} />}
      </Modal>
    </div>
  );
}

function AccessRuleForm({
  admin,
  close,
  saved,
}: {
  admin: AdminClient;
  close: () => void;
  saved: () => void;
}) {
  const copy = useCopy();
  const id = useId();
  const write = useMutation();
  const loadRoles = useCallback(
    async (signal: AbortSignal) => parseRoles(await admin.listRoles({ signal })),
    [admin],
  );
  const roles = useRead(loadRoles, 'rule-roles');
  const [title, setTitle] = useState('');
  const [active, setActive] = useState(true);
  const [documentType, setDocumentType] = useState('');
  const [role, setRole] = useState<string>();
  const [scope, setScope] = useState<Scope>();
  const [operations, setOperations] = useState<Set<string>>(new Set());
  const ready = title.trim() && documentType.trim() && role && scope;
  return (
    <form
      className="module-stack module-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        void write
          .run((signal) =>
            admin.createAccessRule(
              {
                title: title.trim(),
                is_active: active ? 1 : 0,
                document_type: documentType.trim(),
                role,
                scope,
                ...Object.fromEntries(
                  RULE_OPERATIONS.map((operation) => [
                    `allow_${operation}`,
                    operations.has(operation) ? 1 : 0,
                  ]),
                ),
              },
              { signal },
            ),
          )
          .then((result) => {
            if (result !== undefined) saved();
          });
      }}
    >
      <Field id={`${id}-title`} label={copy.ruleTitle}>
        <Input
          id={`${id}-title`}
          required
          maxLength={140}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <div className="admin-switch">
        <Switch id={`${id}-active`} checked={active} onChange={setActive} />
        <label htmlFor={`${id}-active`}>{copy.ruleActive}</label>
      </div>
      <Field id={`${id}-doctype`} label={copy.doctype}>
        <Input
          id={`${id}-doctype`}
          required
          maxLength={140}
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value)}
        />
      </Field>
      <Field id={`${id}-role`} label={copy.ruleRoleField}>
        <Select<string>
          id={`${id}-role`}
          value={role ?? null}
          onChange={setRole}
          loading={roles.state.status === 'loading'}
          options={
            roles.state.status === 'ready'
              ? roles.state.data.map((entry) => ({ value: entry.name, label: entry.name }))
              : []
          }
        />
      </Field>
      <Field id={`${id}-scope`} label={copy.scope}>
        <Select<Scope>
          id={`${id}-scope`}
          value={scope ?? null}
          onChange={setScope}
          options={SCOPES.map((value) => ({ value, label: copy[value] }))}
        />
      </Field>
      <fieldset className="admin-checks">
        <legend>{copy.allowedOperations}</legend>
        {RULE_OPERATIONS.map((operation) => (
          <Checkbox
            key={operation}
            checked={operations.has(operation)}
            onChange={(event) =>
              setOperations((current) => {
                const next = new Set(current);
                if (event.target.checked) next.add(operation);
                else next.delete(operation);
                return next;
              })
            }
          >
            {copy[operation]}
          </Checkbox>
        ))}
      </fieldset>
      <section className="module-stack" aria-label={copy.preview}>
        <h3>{copy.preview}</h3>
        <p>{copy.previewUnavailable}</p>
      </section>
      {write.state.status === 'error' && (
        <Alert role="alert" type="error" message={copy[write.state.error]} />
      )}
      <div className="module-actions">
        <Button onClick={close}>{copy.formCancel}</Button>
        <Button
          type="primary"
          htmlType="submit"
          disabled={!ready}
          loading={write.state.status === 'pending'}
        >
          {copy.saveRule}
        </Button>
      </div>
    </form>
  );
}

function AccessRules({ admin }: { admin: AdminClient }) {
  const copy = useCopy();
  const [adding, setAdding] = useState(false);
  const load = useCallback(
    async (signal: AbortSignal) => parseAccessRules(await admin.listAccessRules({ signal })),
    [admin],
  );
  const read = useRead(load, 'access-rules');
  return (
    <div className="module-stack">
      <div className="module-actions">
        <Button type="primary" onClick={() => setAdding(true)}>
          {copy.addRule}
        </Button>
      </div>
      <AdminResource state={read.state} retry={read.refresh}>
        {(list) =>
          list.length === 0 ? (
            <p>{copy.rulesEmpty}</p>
          ) : (
            <ul className="module-records">
              {list.map((rule) => (
                <li key={rule.name} className="module-record">
                  <div>
                    <p>{rule.title}</p>
                    <dl className="module-context">
                      <div>
                        <dt>{copy.doctype}</dt>
                        <dd>{rule.documentType}</dd>
                      </div>
                      <div>
                        <dt>{copy.ruleRole}</dt>
                        <dd>{rule.role}</dd>
                      </div>
                      <div>
                        <dt>{copy.scope}</dt>
                        <dd>{copy[rule.scope]}</dd>
                      </div>
                    </dl>
                    <p>{rule.active ? copy.active : copy.inactive}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </AdminResource>
      <Modal
        open={adding}
        title={copy.addRule}
        footer={null}
        destroyOnHidden
        onCancel={() => setAdding(false)}
      >
        <AccessRuleForm
          admin={admin}
          close={() => setAdding(false)}
          saved={() => {
            setAdding(false);
            read.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

/** "Kullanıcı izinleri ve kurallar" bölümü: iki sekme. */
export default function PermissionsAndRules() {
  const env = useModule();
  const copy = useCopy();
  const admin = env?.client?.admin;
  const { token } = theme.useToken();
  if (!admin) return <Alert type="info" message={copy.unavailable} />;
  // antd seçili sekmeyi birincil renkle yazar. Açık temada bu renk 4.5:1 vermez.
  // Sekme metni projenin bağlantı rengini kullanır (türetilmiş karar 2).
  const tabs = {
    itemSelectedColor: token.colorLink,
    itemActiveColor: token.colorLinkActive,
    itemHoverColor: token.colorLinkHover,
    inkBarColor: token.colorLink,
  };
  return (
    <ConfigProvider theme={{ components: { Tabs: tabs } }}>
      <Tabs
        items={[
          {
            key: 'permissions',
            label: copy.userPermissions,
            children: <UserPermissions admin={admin} />,
          },
          { key: 'rules', label: copy.accessRules, children: <AccessRules admin={admin} /> },
        ]}
      />
    </ConfigProvider>
  );
}
