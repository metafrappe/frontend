import './studio.css';

import { Attachments, Bubble, Prompts, Sender, Suggestion, Welcome } from '@ant-design/x';
import type { AttachmentsProps } from '@ant-design/x';
import {
  ArrowClockwise,
  ChatCircle,
  Copy,
  Paperclip,
  SidebarSimple,
  ThumbsDown,
  ThumbsUp,
  UploadSimple,
} from '@phosphor-icons/react';
import { App, Button, Drawer, Tag } from 'antd';
import type { GetProp } from 'antd';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import type { GenUIAction, GenUIActionResult } from '@/genui';
import { useGenuiVars } from '@/genui/useGenuiVars';

import { MOCK_SOURCE } from '../agent';
import type {
  AgentMode,
  AgentSource,
  AgentTransport,
  AssistantMessage,
  ChatMessage,
} from '../agent';
import { aiStudioLayout } from '../tokens';
import { useMediaQuery } from '../useMediaQuery';
import { AnswerActions } from './AnswerActions';
import { AssistantBody } from './AssistantBody';
import { ConversationsPanel, type StudioConversation } from './ConversationsPanel';
import { createFlowDemoTransport } from './flowDemo';
import { FlowSteps } from './FlowSteps';
import { ModePicker } from './ModePicker';
import { SLASH_COMMANDS, WELCOME_PROMPTS } from './content';
import { useFlow } from './useFlow';
import { actionToMessage, decisionsOf, useStudioChat } from './useStudioChat';
import { FILE_NAME_ONLY_NOTE, Workspace } from './Workspace';

/**
 * If no transport is given, the mock server is used.
 * If a transport is given, source info must be given too (AX-7).
 */
export type AiStudioProps =
  | { transport?: undefined; source?: undefined }
  | { transport: AgentTransport; source: AgentSource };

/** Three columns open only when both side panels and a readable middle area fit. */
const WIDE_QUERY = `(min-width: ${aiStudioLayout.left + aiStudioLayout.right + 600}px)`;

const FIRST_CONVERSATIONS: StudioConversation[] = [
  { key: 'c1', label: 'Yeni sohbet', group: 'Bugün' },
];

type Feedback = 'like' | 'dislike';

type BubbleItem = GetProp<typeof Bubble.List, 'items'>[number];

type StoredMessages = ReturnType<typeof useStudioChat>['messages'];

type FileItems = NonNullable<AttachmentsProps['items']>;

function StudioInner({ transport, source }: { transport: AgentTransport; source: AgentSource }) {
  const { message: toast } = App.useApp();
  const vars = useGenuiVars();
  const titleId = useId();
  const wide = useMediaQuery(WIDE_QUERY);
  const [conversations, setConversations] = useState(FIRST_CONVERSATIONS);
  const [activeKey, setActiveKey] = useState('c1');
  // The chosen mode applies to the next new task. A started flow keeps its mode.
  const [mode, setMode] = useState<AgentMode>('ask');
  const { flow, flowTransport, start, approve, forget } = useFlow(transport, activeKey);
  const { messages, setMessages, send, cancel, regenerate, retryKind, busy } =
    useStudioChat(flowTransport);
  const store = useRef<Record<string, StoredMessages>>({});
  const nextId = useRef(2);
  // When the drawer closes, focus returns to the button that opened it.
  const leftTrigger = useRef<HTMLButtonElement>(null);
  const rightTrigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef({ left: false, right: false });

  const [value, setValue] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  // Files belong to a conversation. They do not move when switching to another conversation.
  const [filesByConversation, setFilesByConversation] = useState<Record<string, FileItems>>({});
  const files = filesByConversation[activeKey] ?? [];
  const setFiles = (list: FileItems) =>
    setFilesByConversation((all) => ({ ...all, [activeKey]: list }));
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  // As soon as the drawer closes, give focus to the opening button. Otherwise focus falls to the page body.
  useEffect(() => {
    if (wasOpen.current.left && !leftOpen) leftTrigger.current?.focus();
    if (wasOpen.current.right && !rightOpen) rightTrigger.current?.focus();
    wasOpen.current = { left: leftOpen, right: rightOpen };
  }, [leftOpen, rightOpen]);

  const fileNames = files.map((f) => f.name);

  // Decisions come from the conversation history. Blocks stay locked after switching away and back.
  const decisions = useMemo(() => decisionsOf(messages.map((m) => m.message)), [messages]);

  const latestSteps = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i]?.message;
      if (m?.role === 'assistant') return m.steps;
    }
    return [];
  }, [messages]);

  const submit = useCallback(
    (text: string): GenUIActionResult => {
      const trimmed = text.trim();
      if (!trimmed || busy) return 'busy';
      start(mode);
      const result = send({
        role: 'user',
        text: trimmed,
        ...(fileNames.length ? { files: fileNames } : {}),
      });
      if (result !== 'accepted') return result;
      setValue('');
      setConversations((all) =>
        all.map((c) =>
          c.key === activeKey && c.label === 'Yeni sohbet'
            ? { ...c, label: trimmed.slice(0, 40) }
            : c,
        ),
      );
      return 'accepted';
    },
    [activeKey, busy, fileNames, mode, send, start],
  );

  const onAction = useCallback(
    (action: GenUIAction): GenUIActionResult => {
      if (action.kind === 'ask') return submit(action.text);
      // At the approval step the user's approval is written to the flow. Only then does the apply step open.
      const result = send(actionToMessage(action));
      if (result === 'accepted' && action.decision === 'approved') approve();
      return result;
    },
    [approve, send, submit],
  );

  const switchTo = (key: string) => {
    if (key === activeKey) return;
    cancel();
    store.current[activeKey] = messages;
    setMessages(store.current[key] ?? []);
    setActiveKey(key);
    setLeftOpen(false);
  };

  const createConversation = () => {
    const key = `c${nextId.current++}`;
    setConversations((all) => [{ key, label: 'Yeni sohbet', group: 'Bugün' }, ...all]);
    switchTo(key);
  };

  const deleteConversation = (key: string) => {
    const rest = conversations.filter((c) => c.key !== key);
    if (rest.length === 0) return;
    store.current = Object.fromEntries(Object.entries(store.current).filter(([k]) => k !== key));
    setFilesByConversation((all) =>
      Object.fromEntries(Object.entries(all).filter(([k]) => k !== key)),
    );
    setConversations(rest);
    forget(key);
    if (key === activeKey && rest[0]) {
      cancel();
      setMessages(store.current[rest[0].key] ?? []);
      setActiveKey(rest[0].key);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      void toast.success('Yanıt kopyalandı.');
    } catch {
      void toast.error('Kopyalanamadı. Tarayıcı izin vermedi.');
    }
  };

  const actionItems = (id: string) => [
    { key: 'copy', label: 'Kopyala', icon: <Copy aria-hidden /> },
    { key: 'retry', label: 'Yeniden üret', icon: <ArrowClockwise aria-hidden /> },
    {
      key: 'like',
      label: 'Beğen',
      pressed: feedback[id] === 'like',
      icon: <ThumbsUp weight={feedback[id] === 'like' ? 'fill' : 'regular'} aria-hidden />,
    },
    {
      key: 'dislike',
      label: 'Beğenme',
      pressed: feedback[id] === 'dislike',
      icon: <ThumbsDown weight={feedback[id] === 'dislike' ? 'fill' : 'regular'} aria-hidden />,
    },
  ];

  const onActionClick = (id: string, message: AssistantMessage, key: string) => {
    if (key === 'copy') void copy(message.text);
    else if (key === 'retry') regenerate(id);
    else if (key === 'like' || key === 'dislike') {
      setFeedback((all) => ({ ...all, [id]: key }));
    }
  };

  const items: BubbleItem[] = messages.map(({ id, message }): BubbleItem => {
    const key = String(id);
    if (message.role === 'user') {
      return {
        key,
        placement: 'end',
        content: message,
        messageRender: (m: ChatMessage) => (
          <div className="ai-user">
            <span>{m.text}</span>
            {m.role === 'user' && m.files && m.files.length > 0 && (
              <span className="ai-user-files">
                {m.files.map((name) => (
                  <Tag key={name} bordered={false} icon={<Paperclip aria-hidden />}>
                    {name}
                  </Tag>
                ))}
              </span>
            )}
          </div>
        ),
      };
    }
    const finished = message.phase === 'done' || message.phase === 'cancelled';
    return {
      key,
      placement: 'start',
      variant: 'borderless',
      loading: message.phase === 'waiting' && message.steps.length === 0,
      content: message,
      messageRender: (m: ChatMessage) =>
        m.role === 'assistant' ? (
          <AssistantBody
            message={m}
            onAction={onAction}
            onRetry={() => regenerate(key)}
            retryKind={retryKind(id)}
            busy={busy}
            decisions={decisions}
            simulated={source.simulated}
          />
        ) : null,
      ...(finished
        ? {
            footer: (
              <AnswerActions
                items={actionItems(key)}
                onClick={(actionKey) => onActionClick(key, message, actionKey)}
              />
            ),
          }
        : {}),
    };
  });

  const sender = (
    <Suggestion items={SLASH_COMMANDS} onSelect={(command) => setValue(command)}>
      {({ onTrigger, onKeyDown }) => (
        <Sender
          value={value}
          onChange={(next) => {
            setValue(next);
            onTrigger(next === '/' ? undefined : false);
          }}
          onKeyDown={onKeyDown}
          onSubmit={submit}
          onCancel={cancel}
          loading={busy}
          allowSpeech
          placeholder="Sorunuzu yazın. Komut için / yazın."
          aria-label="Asistana mesaj yazın"
          prefix={
            <Button
              type="text"
              icon={<Paperclip aria-hidden />}
              aria-label="Bağlam dosyası ekle"
              aria-expanded={attachOpen}
              onClick={() => setAttachOpen((open) => !open)}
            />
          }
          actions={(_, { components }) => {
            const { SendButton, LoadingButton, SpeechButton } = components;
            return busy ? (
              <LoadingButton aria-label="Yanıtı durdur" />
            ) : (
              <span className="ai-sender-actions">
                <SpeechButton aria-label="Sesle yaz" />
                <SendButton aria-label="Mesajı gönder" />
              </span>
            );
          }}
          header={
            <Sender.Header title="Dosya adları" open={attachOpen} onOpenChange={setAttachOpen}>
              <p className="ai-note">{FILE_NAME_ONLY_NOTE}</p>
              <Attachments
                items={files}
                beforeUpload={() => false}
                onChange={({ fileList }) => setFiles(fileList)}
                placeholder={{
                  icon: <UploadSimple aria-hidden />,
                  title: 'Dosyayı buraya bırakın',
                  description: 'Dosyanın adı yalnız bu sohbete eklenir.',
                }}
              />
            </Sender.Header>
          }
        />
      )}
    </Suggestion>
  );

  const left = (
    <ConversationsPanel
      items={conversations}
      activeKey={activeKey}
      onSelect={switchTo}
      onCreate={createConversation}
      onDelete={deleteConversation}
    />
  );
  const right = <Workspace steps={latestSteps} files={fileNames} source={source} />;

  return (
    <div className={`ai-studio ai-scope ${wide ? 'is-wide' : 'is-narrow'}`} style={vars}>
      {wide && <div className="ai-col ai-col-left">{left}</div>}

      <section className="ai-main" aria-labelledby={titleId}>
        <header className="ai-head">
          {!wide && (
            <Button
              type="text"
              icon={<ChatCircle aria-hidden />}
              ref={leftTrigger}
              aria-label="Sohbetleri aç"
              onClick={() => setLeftOpen(true)}
            />
          )}
          <h1 className="ai-title" id={titleId}>
            AI Studio
          </h1>
          <Tag bordered={false} color={source.simulated ? 'warning' : 'processing'}>
            {source.label}
          </Tag>
          {!wide && (
            <Button
              type="text"
              className="ai-head-end"
              icon={<SidebarSimple aria-hidden />}
              ref={rightTrigger}
              aria-label="Çalışma alanını aç"
              onClick={() => setRightOpen(true)}
            />
          )}
        </header>

        <FlowSteps flow={flow} />

        <div className="ai-log" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 ? (
            <div className="ai-welcome">
              <Welcome
                variant="borderless"
                title="Merhaba, ben Atonota asistanı"
                description="Raporları özetlerim, siparişleri tararım ve otomasyon kurmanıza yardım ederim. Onayınız olmadan hiçbir işlem yapmam."
              />
              <Prompts
                title="Nereden başlayalım?"
                items={WELCOME_PROMPTS}
                wrap
                onItemClick={({ data }) => {
                  if (typeof data.label === 'string' && !data.children) submit(data.label);
                }}
              />
            </div>
          ) : (
            <Bubble.List items={items} autoScroll />
          )}
        </div>
        <p className="ai-visually-hidden" role="status">
          {busy ? 'Asistan yanıt hazırlıyor.' : ''}
        </p>

        <div className="ai-sender">
          <ModePicker value={mode} onChange={setMode} disabled={busy} />
          {sender}
          <p className="ai-hint">Asistan hata yapabilir. Önemli bilgileri kontrol edin.</p>
        </div>
      </section>

      {wide && <div className="ai-col ai-col-right">{right}</div>}

      {!wide && (
        <>
          <Drawer
            title="Sohbetler"
            placement="left"
            open={leftOpen}
            onClose={() => setLeftOpen(false)}
            rootClassName="ai-scope"
            width={`min(85vw, ${aiStudioLayout.left + 60}px)`}
            rootStyle={vars}
          >
            {left}
          </Drawer>
          <Drawer
            title="Çalışma alanı"
            placement="right"
            open={rightOpen}
            onClose={() => setRightOpen(false)}
            rootClassName="ai-scope"
            width={`min(85vw, ${aiStudioLayout.right + 60}px)`}
            rootStyle={vars}
          >
            {right}
          </Drawer>
        </>
      )}
    </div>
  );
}

/**
 * Theme, Turkish locale and focus mode come from the foundation task's `AppProviders` layer.
 * AI Studio page. Conversations on the left, messages in the middle, workspace on the right.
 * On a narrow screen it becomes one column. The left and right panels move into drawers.
 */
export function AiStudio({ transport, source }: AiStudioProps) {
  const resolvedTransport = useMemo(() => transport ?? createFlowDemoTransport(), [transport]);
  const resolvedSource = source ?? MOCK_SOURCE;
  return (
    <App component={false}>
      <StudioInner transport={resolvedTransport} source={resolvedSource} />
    </App>
  );
}
