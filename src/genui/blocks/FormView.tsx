import { CheckCircle, Lightning, XCircle } from '@phosphor-icons/react';
import { Alert, Button, Checkbox, Form, Input, Select, Tag } from 'antd';
import { useState } from 'react';

import type {
  FieldChange,
  FormBlock,
  FormField,
  FormValues,
  GenUIActionHandler,
  GenUIDecision,
} from '../types';
import { ChangeTable } from './ChangeTable';
import { BUSY_NOTE, FAILED_NOTE, USED_NOTE, useDecision } from './useDecision';

function initialValues(fields: FormField[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    if (field.value !== undefined) values[field.name] = field.value;
    else values[field.name] = field.kind === 'checks' ? [] : '';
  }
  return values;
}

/** Turns a value into readable on-screen text. For options it shows the label. */
function display(field: FormField, value: string | string[] | undefined): string {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const labels = list.map((v) => field.options?.find((o) => o.value === v)?.label ?? v);
  return labels.join(', ');
}

function diff(fields: FormField[], before: FormValues, after: FormValues): FieldChange[] {
  return fields.map((field) => ({
    field: field.label,
    before: display(field, before[field.name]),
    after: display(field, after[field.name]),
  }));
}

/**
 * Form.Item passes the ID, value and change handler to its child.
 * So all incoming props are forwarded to the control.
 */
function FieldControl({
  field,
  disabled,
  ...control
}: {
  field: FormField;
  disabled: boolean;
  id?: string;
}) {
  const options = field.options ?? [];
  switch (field.kind) {
    case 'select':
      return <Select {...control} size="small" options={options} disabled={disabled} />;
    case 'checks':
      return <Checkbox.Group {...control} options={options} disabled={disabled} />;
    default:
      return <Input {...control} size="small" disabled={disabled} />;
  }
}

/**
 * Form block (U4, AX-6).
 * The Save button shows the diff first. Values are sent only with "Approve and send".
 * The backend does the save. The UI never invents the save result itself.
 */
export function FormView({
  block,
  onAction,
  busy = false,
  decided,
}: {
  block: FormBlock;
  onAction: GenUIActionHandler;
  busy?: boolean;
  decided?: GenUIDecision | undefined;
}) {
  const [form] = Form.useForm<FormValues>();
  const [initial] = useState(() => initialValues(block.fields));
  const [pending, setPending] = useState<FormValues | null>(null);
  const { decision, notice, locked, apply } = useDecision(decided);

  const send = (next: GenUIDecision, values?: FormValues) => {
    if (locked || busy) return;
    const result = onAction({
      kind: 'form',
      blockId: block.id,
      decision: next,
      title: block.title,
      ...(values ? { values } : {}),
    });
    apply(next, result);
  };

  const tag =
    decision === 'approved'
      ? 'Onay gönderildi'
      : decision === 'rejected'
        ? 'Vazgeçildi'
        : notice === 'used'
          ? 'Daha önce gönderildi'
          : pending
            ? 'Değişikliği kontrol edin'
            : 'Taslak, onayınızı bekliyor';

  return (
    <section data-genui="form" className="genui-card genui-form">
      <header className="genui-card-h">
        <Lightning aria-hidden />
        <strong>{block.title}</strong>
        <Tag bordered={false} className="genui-tag">
          {tag}
        </Tag>
      </header>
      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={initial}
        onFinish={(values) => setPending(values)}
        disabled={locked || pending !== null}
        requiredMark={false}
      >
        <div className="genui-fields">
          {block.fields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              rules={field.required ? [{ required: true, message: `${field.label} gerekli.` }] : []}
            >
              <FieldControl field={field} disabled={locked || pending !== null} />
            </Form.Item>
          ))}
        </div>

        {pending && !locked && (
          <div className="genui-review">
            <p className="genui-summary">Şu değişiklik gönderilecek. Kontrol edip onaylayın.</p>
            <ChangeTable changes={diff(block.fields, initial, pending)} />
          </div>
        )}

        {busy && !locked && <p className="genui-muted-text">{BUSY_NOTE}</p>}
        {notice === 'busy' && <Alert type="error" showIcon message={FAILED_NOTE} role="alert" />}
        {notice === 'used' && <Alert type="warning" showIcon message={USED_NOTE} role="alert" />}

        {locked && !decision ? null : decision ? (
          <p role="status" className="genui-done-line">
            {decision === 'approved' ? (
              <CheckCircle weight="fill" aria-hidden />
            ) : (
              <XCircle weight="fill" aria-hidden />
            )}
            {decision === 'approved'
              ? 'Değerler gönderildi. Kayıt sonucunu asistan yeni mesajla bildirecek.'
              : 'Vazgeçtiniz. Hiçbir kayıt yapılmadı.'}
          </p>
        ) : pending ? (
          <div className="genui-actions">
            <Button
              size="small"
              type="primary"
              disabled={busy}
              onClick={() => send('approved', pending)}
            >
              Onayla ve gönder
            </Button>
            <Button size="small" disabled={false} onClick={() => setPending(null)}>
              Düzenlemeye dön
            </Button>
          </div>
        ) : (
          <div className="genui-actions">
            <Button size="small" type="primary" htmlType="submit" disabled={busy}>
              {block.submitLabel}
            </Button>
            <Button size="small" disabled={busy} onClick={() => send('rejected')}>
              {block.cancelLabel ?? 'Vazgeç'}
            </Button>
          </div>
        )}
      </Form>
    </section>
  );
}
