import { useXAgent, useXChat } from '@ant-design/x';
import { useCallback, useLayoutEffect, useRef } from 'react';

import type { GenUIAction, GenUIActionResult, GenUIDecisions } from '@/genui';

import { emptyAssistant, runAgent } from '../agent';
import type { AgentIntent, AgentTransport, ChatMessage, UserMessage } from '../agent';
import { acceptChunk, newIdempotencyKey } from './generation';
import type { Generation } from './generation';

interface AgentInput {
  message: ChatMessage;
  messages: ChatMessage[];
  intent?: AgentIntent;
  actionId?: string;
  /** Bu yanıtın her parçasının taşıdığı kimlikler. */
  generation: Generation;
  controller: AbortController;
  idempotencyKey?: string;
}

/** Yeniden üretme isteğinde görünen kullanıcı mesajı. Onay verisi taşımaz. */
export const REGENERATE_TEXT = 'Son yanıtı yeniden yaz.';
/** Durum sorgusunda görünen kullanıcı mesajı. Onay verisi taşımaz. */
export const STATUS_TEXT = 'İşlemin durumunu sor.';

/** Kullanıcı kararını sohbette görünen yeni bir mesaja çevirir (U4). */
export function actionToMessage(action: GenUIAction): UserMessage {
  switch (action.kind) {
    case 'ask':
      return { role: 'user', text: action.text };
    case 'confirm':
    case 'form':
      return {
        role: 'user',
        text:
          action.decision === 'approved'
            ? `Onaylıyorum: ${action.title}`
            : `Vazgeçiyorum: ${action.title}`,
        action,
      };
  }
}

/**
 * Mesajın bağlı olduğu işlem kimliği.
 * Onay ya da form kararında blok kimliğidir. Durum sorgusunda sorulan kimliktir.
 * Soru eyleminde kimlik yoktur.
 */
export function actionIdOf(message: ChatMessage | undefined): string | undefined {
  if (message?.role !== 'user') return undefined;
  if (message.statusOf) return message.statusOf;
  if (!message.action || message.action.kind === 'ask') return undefined;
  return message.action.blockId;
}

/** Sohbet geçmişindeki onay ve form kararlarını blok kimliğine göre toplar. */
export function decisionsOf(messages: readonly ChatMessage[]): GenUIDecisions {
  const decisions: Record<string, 'approved' | 'rejected'> = {};
  for (const message of messages) {
    if (message.role !== 'user' || !message.action || message.action.kind === 'ask') continue;
    decisions[message.action.blockId] = message.action.decision;
  }
  return decisions;
}

/** Geçmişe giden mesajdan onay verisini çıkarır. Onay yalnız kendi isteğinde gider. */
function withoutAction(message: ChatMessage): ChatMessage {
  if (message.role !== 'user' || !message.action) return message;
  const { action: _action, ...rest } = message;
  return rest;
}

function isFinished(message: ChatMessage): boolean {
  return message.role === 'user' || message.phase !== 'waiting';
}

/** Onaylanan onay ya da form kararı ticari bir işlemdir. Kendi iş anahtarını taşır. */
function isApproval(message: UserMessage): boolean {
  return (
    (message.action?.kind === 'confirm' || message.action?.kind === 'form') &&
    message.action.decision === 'approved'
  );
}

interface StoredMessage {
  id: string | number;
  message: ChatMessage;
  status: string;
}

/**
 * Hâlâ yüklenen ya da akan yanıtları "durduruldu" olarak kapatır.
 * Durdurulan yanıtın blokları gösterilmez (U5).
 */
function finalize<T extends StoredMessage>(list: readonly T[]): T[] {
  return list.map((item) => {
    if (item.status !== 'loading' && item.status !== 'updating') return item;
    const { message } = item;
    if (message.role !== 'assistant') return { ...item, status: 'success' };
    const open = message.phase === 'waiting' || message.phase === 'streaming';
    return {
      ...item,
      status: 'success',
      message: open ? { ...message, phase: 'cancelled', ui: [] } : message,
    };
  });
}

/**
 * Sohbet durumu. useXAgent isteği çalıştırır, useXChat mesajları tutar.
 *
 * Akış kuralları (AJA-1780):
 * - Her parça konuşma, mesaj ve üretim kimliğini taşır.
 * - Yalnız ekrandaki konuşmanın etkin üretimine ait parçalar yazılır.
 * - Durdurma ve konuşma değişimi üretimi hemen bitirir. Geç gelen parçalar atılır.
 * - Aynı anda tek istek çalışır. Gönder düğmesine ikinci basış mesaj oluşturmaz.
 *
 * Onay kuralları (AX-6):
 * - Onay verisi tek kullanımlıktır. Aynı işlem kimliği ikinci kez gönderilmez.
 * - Onaylanan işlem kendi iş anahtarını taşır (AJA-1749).
 * - "Yeniden üret" yalnız yanıt metnini ister. Onay verisini göndermez.
 * - Onaylı istek koparsa yeniden deneme işlemin durumunu sorar.
 */
export function useStudioChat(transport: AgentTransport, conversationId = 'default') {
  const active = useRef<{ generation: Generation; controller: AbortController } | null>(null);
  const conversation = useRef(conversationId);
  const counter = useRef(0);
  const usedActions = useRef(new Set<string>());

  useLayoutEffect(() => {
    conversation.current = conversationId;
  }, [conversationId]);

  const [agent] = useXAgent<ChatMessage, AgentInput, ChatMessage>({
    request: (
      { message, messages, intent = 'message', actionId, generation, controller, idempotencyKey },
      { onUpdate, onSuccess, onStream },
    ) => {
      onStream?.(controller);
      const current = () =>
        acceptChunk(generation, active.current?.generation ?? null, conversation.current);
      void runAgent({
        transport,
        request: {
          intent,
          message: message as UserMessage,
          history: messages.filter((m) => m !== message && isFinished(m)).map(withoutAction),
          ...(actionId ? { actionId } : {}),
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        signal: controller.signal,
        onUpdate: (update) => {
          if (current()) onUpdate(update);
        },
      }).then((final) => {
        // Durdurulan ya da konuşması değişen üretim hiçbir şey yazmaz. Son durumunu da yazmaz.
        if (!current()) return;
        active.current = null;
        onSuccess([final]);
      });
    },
  });

  const { onRequest, messages, setMessages } = useXChat<
    ChatMessage,
    ChatMessage,
    AgentInput,
    ChatMessage
  >({
    agent,
    requestPlaceholder: () => emptyAssistant(),
    transformMessage: ({ chunk, chunks, originMessage }) =>
      chunk ?? chunks[chunks.length - 1] ?? originMessage ?? emptyAssistant(),
  });

  const last = messages[messages.length - 1];
  const busy = last?.status === 'loading' || last?.status === 'updating';

  /** Yeni bir üretim açar. Önceki üretim bitmiş olmalıdır. */
  const begin = useCallback((messageId?: string) => {
    counter.current += 1;
    const generation: Generation = {
      conversationId: conversation.current,
      messageId: messageId ?? `m${counter.current}`,
      generationId: `g${counter.current}`,
    };
    const controller = new AbortController();
    active.current = { generation, controller };
    return { generation, controller };
  }, []);

  /** Etkin üretimi bitirir. Sonra gelen parçaları atılır. */
  const end = useCallback((): boolean => {
    const running = active.current;
    if (!running) return false;
    active.current = null;
    running.controller.abort();
    return true;
  }, []);

  /** Mesajı gönderir. Sonuç bloğa iletilir. */
  const send = useCallback(
    (message: UserMessage): GenUIActionResult => {
      // Etkin üretim kilittir. Çizimi beklemeden hemen değişir.
      // Art arda iki basış bir kez gönderir. Durdurmadan hemen sonra gönderme kabul edilir.
      if (active.current) return 'busy';
      const actionId = actionIdOf(message);
      if (actionId) {
        if (usedActions.current.has(actionId)) return 'used';
        usedActions.current.add(actionId);
      }
      const { generation, controller } = begin();
      onRequest({
        message: { ...message, clientId: generation.messageId },
        intent: 'message',
        generation,
        controller,
        ...(isApproval(message) ? { idempotencyKey: newIdempotencyKey() } : {}),
      });
      return 'accepted';
    },
    [begin, onRequest],
  );

  /** Yanıtı durdurur. Yanıt ekranda "durduruldu" olarak kalır. */
  const cancel = useCallback(() => {
    if (end()) setMessages((all) => finalize(all));
  }, [end, setMessages]);

  /**
   * Konuşma değişmeden önce yanıtı durdurur.
   * Kapanan mesaj listesini döndürür. Çağıran bu listeyi bu konuşma için saklar.
   */
  const detach = useCallback(() => {
    end();
    let snapshot = finalize(messages);
    setMessages((all) => {
      snapshot = finalize(all);
      return snapshot;
    });
    return snapshot;
  }, [end, messages, setMessages]);

  /**
   * Yanıtı yeniden ister. Her yeniden üretme yeni bir üretim açar.
   * - Önceki mesaj onay değilse: yanıtı ve soruyu kaldırır, soruyu yeniden sorar.
   * - Önceki mesaj onaysa: onay mesajı yerinde kalır. Onay yeniden gitmez.
   *   Yanıt hata ile bittiyse işlemin durumu sorulur. Aksi halde yalnız metin istenir.
   */
  const regenerate = useCallback(
    (assistantId: string | number) => {
      if (active.current) return;
      const index = messages.findIndex((m) => m.id === assistantId);
      const answer = messages[index];
      const prompt = messages[index - 1];
      if (index < 1 || !answer || prompt?.message.role !== 'user') return;

      const actionId = actionIdOf(prompt.message);
      if (actionId) {
        const failed = answer.message.role === 'assistant' && answer.message.phase === 'error';
        setMessages((all) => all.filter((m) => m.id !== assistantId));
        const { generation, controller } = begin();
        const message: UserMessage = failed
          ? { role: 'user', text: STATUS_TEXT, statusOf: actionId }
          : { role: 'user', text: REGENERATE_TEXT };
        onRequest({
          message: { ...message, clientId: generation.messageId },
          intent: failed ? 'status' : 'regenerate',
          ...(failed ? { actionId } : {}),
          generation,
          controller,
        });
        return;
      }

      const user = prompt.message;
      setMessages((all) => all.filter((m) => m.id !== assistantId && m.id !== prompt.id));
      const { generation, controller } = begin(user.clientId);
      onRequest({
        message: { ...user, clientId: generation.messageId },
        intent: 'regenerate',
        generation,
        controller,
      });
    },
    [begin, messages, onRequest, setMessages],
  );

  /** Yanıtın yeniden deneme düğmesi ne yapar: durum sorgusu ya da yeniden deneme. */
  const retryKind = useCallback(
    (assistantId: string | number): 'status' | 'retry' => {
      const index = messages.findIndex((m) => m.id === assistantId);
      return actionIdOf(messages[index - 1]?.message) ? 'status' : 'retry';
    },
    [messages],
  );

  return { messages, setMessages, send, cancel, detach, regenerate, retryKind, busy };
}
