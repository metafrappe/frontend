import { Paperclip, ShieldCheck, Wrench } from '@phosphor-icons/react';
import { Tag } from 'antd';

import { GenUI } from '@/genui';

import type { AgentSource, AgentStep } from '../agent';
import { SIMULATED_TOOLS_NOTE, toEventsBlock } from './chain';

export const FILE_NAME_ONLY_NOTE = 'Yalnız dosya adı gönderilir. Dosya içeriği okunmaz.';

/**
 * Workspace on the right: tool operations, this conversation's file names and security.
 * Source and mode are always visible (AX-7).
 */
export function Workspace({
  steps,
  files,
  source,
}: {
  steps: AgentStep[];
  files: string[];
  source: AgentSource;
}) {
  const events = toEventsBlock(steps);
  return (
    <aside className="ai-workspace" aria-label="Çalışma alanı">
      <section>
        <h2 className="ai-panel-h">
          <Wrench aria-hidden />
          Son yanıtın araç olayları
        </h2>
        {events ? (
          <>
            {source.simulated && <p className="ai-note">{SIMULATED_TOOLS_NOTE}</p>}
            {/* Read-only surface. It produces no actions. */}
            <GenUI blocks={[events]} onAction={() => 'busy'} />
          </>
        ) : (
          <p className="ai-note">Henüz araç işlemi yok. Listeyi yalnız sunucu gönderir.</p>
        )}
      </section>
      <section>
        <h2 className="ai-panel-h">
          <Paperclip aria-hidden />
          Bu sohbetin dosya adları
        </h2>
        <p className="ai-note">{FILE_NAME_ONLY_NOTE}</p>
        {files.length > 0 ? (
          <ul className="ai-files">
            {files.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : (
          <p className="ai-note">Dosya eklenmedi.</p>
        )}
      </section>
      <section>
        <h2 className="ai-panel-h">
          <ShieldCheck aria-hidden />
          Güvenlik
        </h2>
        <dl className="ai-facts">
          <dt>Kaynak</dt>
          <dd>
            <Tag bordered={false} color={source.simulated ? 'warning' : 'processing'}>
              {source.label}
            </Tag>
          </dd>
          <dt>Mod</dt>
          <dd>{source.simulated ? 'Deneme. Gerçek işlem yapılmaz.' : 'Canlı'}</dd>
          <dt>Eylemler</dt>
          <dd>Onayınız olmadan hiçbir işlem yapılmaz.</dd>
        </dl>
      </section>
    </aside>
  );
}
