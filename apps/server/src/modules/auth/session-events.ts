type SessionEndedListener = (sessionId: string) => void

const listeners = new Set<SessionEndedListener>()

/**
 * Subscribes to ended sessions (sign-out, revoked sessions, password change or reset). Lets
 * long-lived connections authenticated by a session (the CRDT WebSockets) drop it without the
 * auth module depending on them.
 */
export const onSessionEnded = (listener: SessionEndedListener) => {
  listeners.add(listener)
}

/** Called by Better Auth's database hook after a session row is deleted. */
export const notifySessionEnded = (sessionId: string) => {
  for (const listener of listeners) listener(sessionId)
}
