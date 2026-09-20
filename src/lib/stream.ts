export type ActionIcon = 'search' | 'globe' | 'brain' | 'code' | 'check';

export type AgentAction = {
  id: string;
  message: string;
  icon?: ActionIcon;
};

export type AgentStreamEvent<T = unknown> =
  | { type: 'action'; action: AgentAction }
  | { type: 'result'; data: T }
  | { type: 'error'; message: string };

export function createAgentStream<T = unknown>() {
  let streamController: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
  });

  const sendEvent = (event: AgentStreamEvent<T>) => {
    try {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      streamController.enqueue(encoder.encode(data));
    } catch (err) {
      console.error('Error enqueueing stream event', err);
    }
  };

  const emitAction = (message: string, icon?: ActionIcon) => {
    sendEvent({
      type: 'action',
      action: {
        id: crypto.randomUUID(),
        message,
        icon,
      },
    });
  };

  const emitResult = (data: T) => {
    sendEvent({ type: 'result', data });
  };

  const emitError = (message: string) => {
    sendEvent({ type: 'error', message });
  };

  const close = () => {
    try {
      streamController.close();
    } catch (err) {
      console.error('Error closing stream', err);
    }
  };

  return {
    stream,
    emitAction,
    emitResult,
    emitError,
    close,
  };
}
