import { Alert, Button, Input, Select } from 'antd';

import { ActionDialog } from '@/components/dialog';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { InviteInput, InvitePreview, UserAdminClient, UserRecord } from '../runtime';
import { failureKind, useMutation, useRead, type FailureKind } from '../data';
import { useCopy } from '../messages';
import { useModule } from '../context';
import { DateValue, Pager, ResourceView, Section } from '../shared';
import { useUserCopy } from './users-messages';
import './users.css';

// The same shape the server checks (`user_admin.invite_user`). The server checks again.
const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,189}$/;

type View = { kind: 'list' } | { kind: 'invite' } | { kind: 'record'; name: string };

/** Loads the user management client once. `null` means the endpoints are not connected. */
function useUserAdmin(): UserAdminClient | null | undefined {
  const load = useModule()?.client?.userAdmin;
  const [client, setClient] = useState<{ load: unknown; value: UserAdminClient | null }>();
  useEffect(() => {
    if (!load) return;
    let live = true;
    load().then(
      (value) => live && setClient({ load, value }),
      () => live && setClient({ load, value: null }),
    );
    return () => {
      live = false;
    };
  }, [load]);
  if (!load) return null;
  return client?.load === load ? client.value : undefined;
}

export function UsersSection() {
  const copy = useCopy();
  const admin = useUserAdmin();
  const [view, setView] = useState<View>({ kind: 'list' });
  return (
    <Section title={copy.users}>
      {admin === undefined ? (
        <p role="status">{copy.loading}</p>
      ) : admin === null ? (
        <Alert type="info" message={copy.unavailable} />
      ) : view.kind === 'invite' ? (
        <InviteForm admin={admin} close={() => setView({ kind: 'list' })} />
      ) : view.kind === 'record' ? (
        <UserRecordView admin={admin} name={view.name} back={() => setView({ kind: 'list' })} />
      ) : (
        <UserList
          admin={admin}
          invite={() => setView({ kind: 'invite' })}
          open={(name) => setView({ kind: 'record', name })}
        />
      )}
    </Section>
  );
}

function Status({ enabled }: { enabled: boolean }) {
  const text = useUserCopy();
  return (
    <span className="users-status" data-enabled={enabled}>
      {enabled ? text.statusActive : text.statusDisabled}
    </span>
  );
}

function UserList({
  admin,
  invite,
  open,
}: {
  admin: UserAdminClient;
  invite: () => void;
  open: (name: string) => void;
}) {
  const text = useUserCopy();
  const [start, setStart] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) => admin.listUsers({ start }, { signal }),
    [admin, start],
  );
  const read = useRead(load, String(start));
  return (
    <div className="module-stack">
      <Button type="primary" className="users-primary" onClick={invite}>
        {text.invite}
      </Button>
      <ResourceView state={read.state} retry={read.refresh}>
        {({ users, hasNext }) =>
          users.length === 0 && start === 0 ? (
            <p>{text.noUsers}</p>
          ) : (
            <>
              <ul className="module-records" aria-label={text.userList}>
                {users.map((user) => (
                  <li key={user.name}>
                    <button type="button" className="users-row" onClick={() => open(user.name)}>
                      <span className="users-name">{user.fullName}</span>
                      <span className="users-email">{user.name}</span>
                      <Status enabled={user.enabled} />
                    </button>
                  </li>
                ))}
              </ul>
              {(hasNext || start > 0) && (
                <Pager label={text.userList} start={start} hasNext={hasNext} change={setStart} />
              )}
            </>
          )
        }
      </ResourceView>
    </div>
  );
}

/** One-shot request with its own abort. The invitation preview only reads. */
function useRequest() {
  const controller = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function run<T>(action: (signal: AbortSignal) => Promise<T>) {
    if (controller.current) return { ok: false as const, error: undefined };
    const current = new AbortController();
    controller.current = current;
    setPending(true);
    try {
      const value = await action(current.signal);
      return { ok: true as const, value };
    } catch (error) {
      return { ok: false as const, error: current.signal.aborted ? undefined : error };
    } finally {
      if (!current.signal.aborted) {
        controller.current = null;
        setPending(false);
      }
    }
  }
  return { pending, run };
}

function InviteForm({ admin, close }: { admin: UserAdminClient; close: () => void }) {
  const copy = useCopy();
  const text = useUserCopy();
  const id = useId();
  const [input, setInput] = useState<InviteInput>({ email: '', firstName: '', lastName: '' });
  const [emailError, setEmailError] = useState<string>();
  const [preview, setPreview] = useState<{ input: InviteInput; value: InvitePreview }>();
  const [previewError, setPreviewError] = useState<FailureKind>();
  const request = useRequest();
  // One write per preview. A new preview needs a new form (G-98, approval digest).
  const send = useMutation();

  async function submit() {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL.test(email)) {
      setEmailError(text.emailInvalid);
      return;
    }
    setEmailError(undefined);
    setPreviewError(undefined);
    const clean = { email, firstName: input.firstName.trim(), lastName: input.lastName.trim() };
    const result = await request.run((signal) => admin.previewInvite(clean, { signal }));
    if (result.ok) setPreview({ input: clean, value: result.value });
    else if (result.error !== undefined) {
      const kind = failureKind(result.error);
      if (kind === 'requestRejected') setEmailError(text.emailInvalid);
      else setPreviewError(kind);
    }
  }

  const change = (field: keyof InviteInput) => (event: { target: { value: string } }) => {
    setInput((value) => ({ ...value, [field]: event.target.value }));
    setPreview(undefined);
  };

  if (send.state.status === 'success')
    return (
      <div className="module-stack">
        <Alert type="success" role="status" message={text.inviteSent} />
        <p>{text.inviteAfter}</p>
        <Button className="users-primary" onClick={close}>
          {text.backToList}
        </Button>
      </div>
    );

  return (
    <div className="module-stack">
      <Button type="text" className="users-back" onClick={close}>
        ‹ {text.inviteCancel}
      </Button>
      <h3 className="users-title">{text.inviteTitle}</h3>
      <p>{text.inviteNote}</p>
      <form
        className="module-stack module-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={`${id}-email`}>{text.email}</label>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="off"
          maxLength={254}
          value={input.email}
          status={emailError ? 'error' : ''}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? `${id}-email-error` : undefined}
          onChange={change('email')}
        />
        {emailError && (
          <p id={`${id}-email-error`} className="users-field-error" role="alert">
            {emailError}
          </p>
        )}
        <label htmlFor={`${id}-first`}>{text.firstName}</label>
        <Input
          id={`${id}-first`}
          maxLength={150}
          value={input.firstName}
          onChange={change('firstName')}
        />
        <label htmlFor={`${id}-last`}>{text.lastName}</label>
        <Input
          id={`${id}-last`}
          maxLength={150}
          value={input.lastName}
          onChange={change('lastName')}
        />
        {previewError && (
          <Alert
            type="error"
            role="alert"
            message={previewError === 'conflict' ? text.userExists : copy[previewError]}
          />
        )}
        {!preview && (
          <Button
            type="primary"
            htmlType="submit"
            className="users-primary"
            loading={request.pending}
          >
            {text.inviteSend}
          </Button>
        )}
      </form>
      {preview && (
        <div className="module-stack module-review">
          <p>{text.invitePreview}</p>
          <ul>
            {preview.value.operations.map((item, index) => (
              <li key={`${item.operation}-${index}`}>
                {item.operation}
                {item.target ? `: ${item.target}` : ''}
              </li>
            ))}
          </ul>
          {send.state.status === 'error' && (
            <Alert
              type="error"
              role="alert"
              message={
                send.state.error === 'conflict' ? text.inviteChanged : copy[send.state.error]
              }
            />
          )}
          {send.state.status !== 'error' && (
            <Button
              type="primary"
              className="users-primary"
              loading={send.state.status === 'pending'}
              onClick={() =>
                void send.run((signal) =>
                  admin.sendInvite(preview.input, preview.value.digest, { signal }),
                )
              }
            >
              {text.inviteConfirm}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function RoleList({ roles }: { roles: readonly string[] }) {
  const copy = useCopy();
  if (roles.length === 0) return <p>{copy.empty}</p>;
  return (
    <ul className="users-roles">
      {roles.map((role) => (
        <li key={role}>{role}</li>
      ))}
    </ul>
  );
}

function UserRecordView({
  admin,
  name,
  back,
}: {
  admin: UserAdminClient;
  name: string;
  back: () => void;
}) {
  const env = useModule();
  const text = useUserCopy();
  const load = useCallback((signal: AbortSignal) => admin.getUser(name, { signal }), [admin, name]);
  const read = useRead(load, name);
  // The answer of the assignment. The record read may hide the profile (permission level 1).
  const [assigned, setAssigned] = useState<{ roleProfiles: string[]; roles: string[] }>();
  const [changing, setChanging] = useState(false);
  const self = env?.user === name;
  return (
    <div className="module-stack">
      <Button type="text" className="users-back" onClick={back}>
        ‹ {text.backToUsers}
      </Button>
      <ResourceView state={read.state} retry={read.refresh}>
        {(loaded) => {
          const record: UserRecord = assigned ? { ...loaded, ...assigned } : loaded;
          return (
            <div className="module-stack">
              <h3 className="users-title">{record.fullName}</h3>
              <p className="users-email">{record.name}</p>
              <Status enabled={record.enabled} />
              {record.lastLogin && (
                <p>
                  {text.lastLogin}: <DateValue value={record.lastLogin} />
                </p>
              )}
              {assigned && (
                <Alert type="success" role="status" message={text.roleProfileAssigned} />
              )}
              <h4 className="users-subtitle">{text.roleProfile}</h4>
              {record.roleProfiles === undefined ? (
                <p>{text.roleProfileHidden}</p>
              ) : (
                <p>
                  {record.roleProfiles.length ? record.roleProfiles.join(', ') : text.noRoleProfile}
                </p>
              )}
              <Button
                className="users-primary"
                disabled={self}
                aria-describedby={self ? `${name}-self` : undefined}
                onClick={() => setChanging(true)}
              >
                {text.roleProfileChange}
              </Button>
              {self && <p id={`${name}-self`}>{text.roleProfileSelf}</p>}
              {record.roles && (
                <>
                  <h4 className="users-subtitle">{text.profileRoles}</h4>
                  <RoleList roles={record.roles} />
                </>
              )}
              {changing && !self && (
                <RoleProfileDialog
                  admin={admin}
                  user={record}
                  close={() => setChanging(false)}
                  done={(result) => {
                    setAssigned(result);
                    setChanging(false);
                  }}
                />
              )}
            </div>
          );
        }}
      </ResourceView>
    </div>
  );
}

function RoleProfileDialog({
  admin,
  user,
  close,
  done,
}: {
  admin: UserAdminClient;
  user: UserRecord;
  close: () => void;
  done: (result: { roleProfiles: string[]; roles: string[] }) => void;
}) {
  const copy = useCopy();
  const text = useUserCopy();
  const id = useId();
  const [selected, setSelected] = useState<string>();
  const loadProfiles = useCallback(
    (signal: AbortSignal) => admin.listRoleProfiles({ signal }),
    [admin],
  );
  const profiles = useRead(loadProfiles, 'profiles');
  const loadRoles = useCallback(
    (signal: AbortSignal) => admin.getRoleProfile(selected ?? '', { signal }),
    [admin, selected],
  );
  const roles = useRead(selected ? loadRoles : null, selected ?? '');
  const assign = useMutation();
  const before = user.roles;
  return (
    <ActionDialog
      open
      title={text.roleProfileChange}
      onCancel={close}
      destroyOnHidden
      width="min(100%, 40rem)"
    >
      <div className="module-stack">
        <ResourceView state={profiles.state} retry={profiles.refresh}>
          {(names) => (
            <div className="module-stack">
              <label htmlFor={`${id}-profile`}>{text.roleProfile}</label>
              <Select<string>
                id={`${id}-profile`}
                placeholder={text.roleProfileSelect}
                value={selected ?? null}
                onChange={setSelected}
                options={names.map((value) => ({ value, label: value }))}
              />
            </div>
          )}
        </ResourceView>
        {selected && (
          <ResourceView state={roles.state} retry={roles.refresh}>
            {(profile) => (
              <div className="users-compare">
                <div className="module-stack">
                  <h4 className="users-subtitle">{text.before}</h4>
                  {before ? <RoleList roles={before} /> : <p>{text.unknownRoles}</p>}
                </div>
                <div className="module-stack">
                  <h4 className="users-subtitle">{text.after}</h4>
                  <ul className="users-roles">
                    {profile.roles.map((role) => (
                      <li key={role}>
                        <span>{role}</span>
                        {before && !before.includes(role) && <span> {text.added}</span>}
                      </li>
                    ))}
                  </ul>
                  {before
                    ?.filter((role) => !profile.roles.includes(role))
                    .map((role) => (
                      <p key={role}>{text.removed.replace('{role}', role)}</p>
                    ))}
                </div>
              </div>
            )}
          </ResourceView>
        )}
        {assign.state.status === 'error' && (
          <Alert type="error" role="alert" message={copy[assign.state.error]} />
        )}
        <Button
          type="primary"
          className="users-primary"
          disabled={!selected || roles.state.status !== 'ready' || assign.state.status === 'error'}
          loading={assign.state.status === 'pending'}
          onClick={async () => {
            if (!selected) return;
            const result = await assign.run((signal) =>
              admin.setRoleProfiles(user.name, [selected], { signal }),
            );
            if (result) done(result);
          }}
        >
          {text.roleProfileAssign}
        </Button>
      </div>
    </ActionDialog>
  );
}
