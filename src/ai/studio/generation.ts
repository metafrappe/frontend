/**
 * Identity of one reply generation.
 * Every stream chunk carries all three IDs. A chunk without them is not written to the screen.
 */
export interface Generation {
  /** Conversation the request was sent from. */
  conversationId: string;
  /** User message the reply belongs to. */
  messageId: string;
  /** One run of the reply. Regenerate and a new message each open a new run. */
  generationId: string;
}

/**
 * Decides whether a stream chunk may be written to the screen.
 *
 * - All three IDs must be present.
 * - The chunk must belong to the active generation. A stopped generation is no longer active.
 * - The chunk must belong to the conversation on screen.
 */
export function acceptChunk(
  chunk: Partial<Generation>,
  active: Generation | null,
  conversationId: string,
): boolean {
  if (!chunk.conversationId || !chunk.messageId || !chunk.generationId) return false;
  if (!active) return false;
  return (
    chunk.conversationId === conversationId &&
    chunk.conversationId === active.conversationId &&
    chunk.messageId === active.messageId &&
    chunk.generationId === active.generationId
  );
}

/** Creates a lower-case UUID 4. The idempotency key contract (AJA-1749) asks for this format. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID().toLowerCase();
}
