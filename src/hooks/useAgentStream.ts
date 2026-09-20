import { useState, useCallback } from 'react';
import { AgentAction, AgentStreamEvent } from '@/lib/stream';

export function useAgentStream<T = any>() {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const reset = useCallback(() => {
    setActions([]);
    setIsRunning(false);
    setError(undefined);
  }, []);

  const runStream = useCallback(async (
    url: string,
    body: any,
    onResult?: (result: T) => void,
    onError?: (error: string) => void
  ) => {
    setIsRunning(true);
    setActions([]);
    setError(undefined);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch from ${url}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process line by line
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (!dataStr.trim()) continue;

            try {
              const event = JSON.parse(dataStr) as AgentStreamEvent<T>;
              if (event.type === 'action') {
                setActions((prev) => [...prev, event.action]);
              } else if (event.type === 'result') {
                if (onResult) onResult(event.data);
              } else if (event.type === 'error') {
                throw new Error(event.message);
              }
            } catch (err) {
              console.error('Error parsing SSE event:', err, dataStr);
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      if (onError) onError(message);
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, []);

  return {
    actions,
    isRunning,
    error,
    runStream,
    reset,
  };
}
