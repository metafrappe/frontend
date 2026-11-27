import { Minus, Plus } from '@phosphor-icons/react';
import { Button, Form, Input, InputNumber, Space } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PageHeader } from '../header/PageHeader';
import type { HeaderState } from '../header/PageHeader';
import { t } from '../messages';
import { routes } from '../paths';
import type { SampleRow } from '../sampleData';
import { findGroup, findLeaf, sampleRows } from '../sampleData';
import { useViewData } from '../view-data';

type Draft = Pick<SampleRow, 'title' | 'party' | 'amount'>;

export default function RecordPage() {
  const { module = '', doctype = '', name = '' } = useParams();
  const navigate = useNavigate();
  const rows = useMemo(() => sampleRows(doctype), [doctype]);
  const index = rows.findIndex((r) => r.name === name);
  const row = rows[index];
  const leaf = findLeaf(module, doctype);
  const group = findGroup(module);
  // If the app entry has connected the record view, the record comes from the server. The sample record is
  // shown only when there is no connection (test pages).
  const Live = useViewData()?.record?.Component;

  // The shell renders the page frame. The record component supplies only the content.
  if (Live) {
    return (
      <div className="shell-page">
        <div className="shell-body">
          <Live module={module} doctype={doctype} name={name} />
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="shell-page">
        <div className="shell-body">
          <h1>{t.pages.notFound}</h1>
        </div>
      </div>
    );
  }

  return (
    <RecordForm
      key={row.name}
      row={row}
      index={index + 1}
      total={rows.length}
      crumbs={[
        ...(group ? [{ label: group.label }] : []),
        { label: leaf?.label ?? doctype, to: routes.collection(module, doctype) },
        { label: row.name },
      ]}
      onGo={(i) => {
        const r = rows[i - 1];
        if (r) navigate(routes.record(module, doctype, r.name));
      }}
      onViewChange={(v) => v !== 'form' && navigate(routes.collection(module, doctype, v))}
    />
  );
}

interface RecordFormProps {
  row: SampleRow;
  index: number;
  total: number;
  crumbs: { label: string; to?: string }[];
  onGo: (i: number) => void;
  onViewChange: (v: Parameters<typeof PageHeader>[0]['view']) => void;
}

function RecordForm({ row, index, total, crumbs, onGo, onViewChange }: RecordFormProps) {
  const initial: Draft = { title: row.title, party: row.party, amount: row.amount };
  const [saved, setSaved] = useState<Draft>(initial);
  const [draft, setDraft] = useState<Draft>(initial);
  const changes = (Object.keys(draft) as (keyof Draft)[]).filter(
    (k) => draft[k] !== saved[k],
  ).length;

  const state: HeaderState =
    changes > 0
      ? {
          kind: 'dirty',
          changes,
          onDiscard: () => setDraft(saved),
          onSave: () => setSaved(draft),
        }
      : { kind: 'normal', syncedAt: '10:42' };

  return (
    <div className="shell-page">
      <PageHeader
        title={row.title}
        crumbs={crumbs}
        view="form"
        onViewChange={onViewChange}
        state={state}
        record={{
          index,
          total,
          onPrev: () => onGo(index - 1),
          onNext: () => onGo(index + 1),
        }}
      />
      <div className="shell-body">
        <p className="shell-muted">{t.pages.sample}</p>
        <Form layout="vertical" className="shell-form">
          <Form.Item label="Başlık" htmlFor="rec-title">
            <Input
              id="rec-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="Kişi" htmlFor="rec-party">
            <Input
              id="rec-party"
              value={draft.party}
              onChange={(e) => setDraft({ ...draft, party: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="Tutar" htmlFor="rec-amount">
            {/* antd's own arrows have English names and are small. Buttons with Turkish names are used (K4). */}
            <Space.Compact block>
              <InputNumber<number>
                id="rec-amount"
                className="shell-wide"
                value={draft.amount}
                min={0}
                controls={false}
                onChange={(v) => setDraft({ ...draft, amount: v ?? 0 })}
              />
              <Button
                aria-label={t.pages.decrease}
                icon={<Minus aria-hidden="true" />}
                disabled={draft.amount <= 0}
                onClick={() => setDraft({ ...draft, amount: Math.max(0, draft.amount - 1) })}
              />
              <Button
                aria-label={t.pages.increase}
                icon={<Plus aria-hidden="true" />}
                onClick={() => setDraft({ ...draft, amount: draft.amount + 1 })}
              />
            </Space.Compact>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
