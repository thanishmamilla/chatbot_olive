import { Logger } from '@nestjs/common';

export interface LlmRequestMetadata {
  sessionId?: string;
  model: string;
  provider: string;
  message: string;
  historyCount: number;
}

export class LlmLoggerWrapper {
  private static readonly logger = new Logger('LlmLoggerWrapper');

  /**
   * Wraps an LLM call to capture inference metadata and log it to the console in near real-time.
   * 
   * @param meta Metadata about the prompt request
   * @param fn The actual LLM API invocation promise factory
   */
  static async wrapCall<T extends { response: any }>(
    meta: LlmRequestMetadata,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = new Date();
    let status: 'success' | 'error' = 'success';
    let errorMsg: string | undefined;
    let outputText = '';
    let tokens: { prompt?: number; candidates?: number; total?: number } = {};

    try {
      const result = await fn();
      const response = await result.response;
      outputText = typeof response.text === 'function' ? response.text() : '';

      if (response.usageMetadata) {
        tokens = {
          prompt: response.usageMetadata.promptTokenCount,
          candidates: response.usageMetadata.candidatesTokenCount,
          total: response.usageMetadata.totalTokenCount,
        };
      }

      return result;
    } catch (err: any) {
      status = 'error';
      errorMsg = err.message || String(err);
      throw err;
    } finally {
      const endTime = new Date();
      const latency = endTime.getTime() - startTime.getTime();

      const logPayload = {
        provider: meta.provider,
        model: meta.model,
        sessionId: meta.sessionId || 'N/A',
        timestamp: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        },
        latencyMs: latency,
        status,
        inputPreview: meta.message.length > 200 ? meta.message.substring(0, 200) + '...' : meta.message,
        outputPreview: status === 'success'
          ? (outputText.length > 200 ? outputText.substring(0, 200) + '...' : outputText)
          : undefined,
        tokenUsage: status === 'success' ? {
          input: tokens.prompt || 0,
          output: tokens.candidates || 0,
          total: tokens.total || 0,
        } : undefined,
        historyCount: meta.historyCount,
        error: errorMsg,
      };

      console.log('====== [LLM INFERENCE METADATA] ======\n' + 
                  JSON.stringify(logPayload, null, 2) + 
                  '\n======================================');

      // Send the log payload to the Ingestion API endpoint
      const port = process.env.PORT || 3001;
      fetch(`http://localhost:${port}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logPayload),
      }).catch(err => {
        LlmLoggerWrapper.logger.error(`Failed to send log to ingestion service: ${err.message}`);
      });
    }
  }

  /**
   * Wraps an LLM streaming call to capture inference metadata and stream chunks.
   */
  static async wrapStreamCall(
    meta: LlmRequestMetadata,
    fn: () => Promise<any>,
    onChunk: (text: string) => void
  ): Promise<any> {
    const startTime = new Date();
    let status: 'success' | 'error' = 'success';
    let errorMsg: string | undefined;
    let outputText = '';
    let tokens: { prompt?: number; candidates?: number; total?: number } = {};
    let result: any;

    try {
      result = await fn();
      
      for await (const chunk of result.stream) {
        const chunkText = typeof chunk.text === 'function' ? chunk.text() : '';
        outputText += chunkText;
        onChunk(chunkText);
      }

      const response = await result.response;
      if (response.usageMetadata) {
        tokens = {
          prompt: response.usageMetadata.promptTokenCount,
          candidates: response.usageMetadata.candidatesTokenCount,
          total: response.usageMetadata.totalTokenCount,
        };
      }

      return result;
    } catch (err: any) {
      status = 'error';
      errorMsg = err.message || String(err);
      throw err;
    } finally {
      const endTime = new Date();
      const latency = endTime.getTime() - startTime.getTime();

      const logPayload = {
        provider: meta.provider,
        model: meta.model,
        sessionId: meta.sessionId || 'N/A',
        timestamp: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        },
        latencyMs: latency,
        status,
        inputPreview: meta.message.length > 200 ? meta.message.substring(0, 200) + '...' : meta.message,
        outputPreview: status === 'success'
          ? (outputText.length > 200 ? outputText.substring(0, 200) + '...' : outputText)
          : undefined,
        tokenUsage: status === 'success' ? {
          input: tokens.prompt || 0,
          output: tokens.candidates || 0,
          total: tokens.total || 0,
        } : undefined,
        historyCount: meta.historyCount,
        error: errorMsg,
      };

      console.log('====== [LLM INFERENCE METADATA (STREAM)] ======\n' + 
                  JSON.stringify(logPayload, null, 2) + 
                  '\n===============================================');

      // Send the log payload to the Ingestion API endpoint
      const port = process.env.PORT || 3001;
      fetch(`http://localhost:${port}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logPayload),
      }).catch(err => {
        LlmLoggerWrapper.logger.error(`Failed to send stream log to ingestion service: ${err.message}`);
      });
    }
  }
}
