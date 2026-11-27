import { Prompts, Sender } from '@ant-design/x';
import { LocalizedXProvider } from '@/app/locale/LocalizedXProvider';
import { Segmented } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { t } from '../messages';
import type { QuickAction } from '../nav';
import { routes } from '../paths';

export type CommandMode = 'ask' | 'do' | 'search';

interface CommandBoxProps {
  /** Quick actions. If the list is empty the section is not rendered. No made-up suggestions are shown. */
  actions?: readonly QuickAction[];
  onSubmitted?: () => void;
  mode?: CommandMode | undefined;
  onModeChange?: ((mode: CommandMode) => void) | undefined;
}

/**
 * Command box. A submitted request goes to the assistant page.
 * This version produces no reply. No fake reply is shown.
 */
export function CommandBox({
  actions = [],
  onSubmitted,
  mode: controlledMode,
  onModeChange,
}: CommandBoxProps) {
  const [localMode, setLocalMode] = useState<CommandMode>('ask');
  const mode = controlledMode ?? localMode;
  const setMode = (next: CommandMode) => {
    setLocalMode(next);
    onModeChange?.(next);
  };
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  const submit = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setValue('');
    navigate(routes.assistant(), { state: { q, mode } });
    onSubmitted?.();
  };

  // A page action opens the page. A request action sends the request to the assistant.
  const runAction = (action: QuickAction | undefined) => {
    if (!action) return;
    if (action.to) {
      navigate(action.to);
      onSubmitted?.();
      return;
    }
    if (action.prompt) submit(action.prompt);
  };

  return (
    <LocalizedXProvider>
      <section className="shell-cmd" aria-label={t.command.label}>
        <div className="shell-cmd-box">
          <Segmented<CommandMode>
            size="small"
            block
            aria-label={t.command.modeLabel}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'ask', label: t.command.modes.ask },
              { value: 'do', label: t.command.modes.do },
              { value: 'search', label: t.command.modes.search },
            ]}
          />
          <Sender
            className="shell-sender"
            value={value}
            onChange={(v) => setValue(v)}
            onSubmit={submit}
            placeholder={t.command.placeholder}
          />
        </div>
        {actions.length > 0 && (
          <div className="shell-chips" role="group" aria-label={t.command.suggestions}>
            <Prompts
              items={actions.map((a) => ({ key: a.key, label: a.label }))}
              onItemClick={({ data }) => runAction(actions.find((a) => a.key === data.key))}
            />
          </div>
        )}
      </section>
    </LocalizedXProvider>
  );
}
