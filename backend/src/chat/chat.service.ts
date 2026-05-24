import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { LlmLoggerWrapper } from './llm-logger.wrapper';

interface ChatMessage {
    role: 'user' | 'bot';
    text: string;
}

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(private configService: ConfigService) { }

    async generateResponse(message: string, messages: ChatMessage[], sessionId?: string): Promise<string> {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error("Gemini API key is not configured. Please set GEMINI_API_KEY in your backend/.env file.");
        }

        if (apiKey === 'your_actual_gemini_api_key_here' || apiKey.includes('your_') || apiKey === 'dummy-key') {
            throw new Error("You are using a placeholder Gemini API key. Please replace it with a valid key from Google AI Studio.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        
        try {
            this.logger.log("Running Gemini API Key diagnostics (listing models)...");
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const data = await res.json() as any;

            if (!res.ok) {
                throw new Error(data.error?.message || `HTTP ${res.status} ${res.statusText}`);
            }

            const modelNames = (data.models || []).map((m: any) => m.name);
            this.logger.log(`API Key is VALID! Available models: ${modelNames.join(', ')}`);
        } catch (diagError: any) {
            this.logger.error(`API Key diagnostics FAILED: ${diagError.message}`);

            throw new Error(
                `Gemini API Key diagnostics failed: "${diagError.message}". ` +
                `This means Google rejected your API key. Please make sure it's correct, ` +
                `active in Google AI Studio, and that the 'Generative Language API' is enabled.`
            );
        }

        
        const modelCandidates = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
        let lastError: any = null;

        for (const modelName of modelCandidates) {
            try {
                this.logger.log(`Attempting to generate response with model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });

                
                const history = messages.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                }));

                const chat = model.startChat({ history });
                
                
                const result = await LlmLoggerWrapper.wrapCall(
                    {
                        sessionId,
                        model: modelName,
                        provider: 'Google Gemini',
                        message,
                        historyCount: history.length,
                    },
                    () => chat.sendMessage(message)
                );

                const response = await result.response;
                return response.text();
            } catch (error: any) {
                this.logger.warn(`Model ${modelName} failed or unavailable: ${error.message}`);
                lastError = error;
                
            }
        }

        
        this.logger.error("All Gemini model candidates failed to respond.");
        throw lastError;
    }

    async generateResponseStream(
        message: string,
        messages: ChatMessage[],
        modelType: string,
        onChunk: (text: string) => void,
        sessionId?: string
    ): Promise<void> {
        this.logger.log(`Routing stream generation request for modelType: ${modelType}`);

        if (modelType === 'chatgpt') {
            const apiKey = this.configService.get<string>('OPENAI_API_KEY');
            const hasRealKey = apiKey && apiKey !== 'your_openai_api_key_here' && !apiKey.includes('dummy') && apiKey.trim() !== '';

            if (!hasRealKey) {
                this.logger.warn("OpenAI API key missing or placeholder. Running ChatGPT simulated fallback.");
                await this.simulateStream(
                    'OpenAI ChatGPT',
                    'gpt-4o',
                    message,
                    messages.length,
                    sessionId,
                    onChunk,
                    `[Simulated ChatGPT Response]: Hello! I am OpenAI's ChatGPT (gpt-4o) running in fallback mode because no valid OPENAI_API_KEY was configured in the backend environment. You asked me: "${message}". Please configure a real OpenAI API key to enable live responses.`
                );
                return;
            }

            try {
                this.logger.log("Initiating real OpenAI ChatGPT stream (gpt-4o)...");
                const openai = new OpenAI({ apiKey });
                const messagesParam = [
                    ...messages.map(m => ({
                        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
                        content: m.text,
                    })),
                    { role: 'user' as const, content: message }
                ];

                const streamPromise = openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: messagesParam,
                    stream: true,
                    stream_options: { include_usage: true },
                });

                const wrappedFactory = async () => {
                    const oStream = await streamPromise;
                    let resolveResponse: (value: any) => void;
                    const responsePromise = new Promise((resolve) => {
                        resolveResponse = resolve;
                    });

                    const asyncGenerator = async function* () {
                        let finalUsage: any = null;
                        let accumulatedText = '';
                        try {
                            for await (const chunk of oStream) {
                                if (chunk.usage) {
                                    finalUsage = chunk.usage;
                                }
                                const text = chunk.choices[0]?.delta?.content || '';
                                accumulatedText += text;
                                yield {
                                    text: () => text,
                                };
                            }
                        } finally {
                            const promptTokens = finalUsage?.prompt_tokens || Math.round(message.length / 4);
                            const completionTokens = finalUsage?.completion_tokens || Math.round(accumulatedText.length / 4);
                            resolveResponse({
                                usageMetadata: {
                                    promptTokenCount: promptTokens,
                                    candidatesTokenCount: completionTokens,
                                    totalTokenCount: promptTokens + completionTokens,
                                },
                            });
                        }
                    };

                    return {
                        stream: asyncGenerator(),
                        response: responsePromise,
                    };
                };

                await LlmLoggerWrapper.wrapStreamCall(
                    {
                        sessionId,
                        model: 'gpt-4o',
                        provider: 'OpenAI ChatGPT',
                        message,
                        historyCount: messagesParam.length - 1,
                    },
                    wrappedFactory,
                    onChunk
                );
                return;
            } catch (err: any) {
                this.logger.error(`Real OpenAI connection failed: ${err.message}. Falling back to simulated stream.`);
                modelType = 'other';
            }
        }

        if (modelType === 'claude') {
            const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
            const hasRealKey = apiKey && apiKey !== 'your_anthropic_api_key_here' && !apiKey.includes('dummy') && apiKey.trim() !== '';

            if (!hasRealKey) {
                this.logger.warn("Anthropic API key missing or placeholder. Running Claude simulated fallback.");
                await this.simulateStream(
                    'Anthropic Claude',
                    'claude-3-5-sonnet',
                    message,
                    messages.length,
                    sessionId,
                    onChunk,
                    `[Simulated Claude Response]: Hello there! I am Anthropic's Claude (claude-3-5-sonnet) running in fallback mode because no valid ANTHROPIC_API_KEY was configured in the backend environment. You asked: "${message}". Set a real Anthropic API key to enable live Claude intelligence.`
                );
                return;
            }

            try {
                this.logger.log("Initiating real Anthropic Claude stream (claude-3-5-sonnet-20241022)...");
                const anthropic = new Anthropic({ apiKey });
                const messagesParam = messages.map(m => ({
                    role: m.role === 'user' ? 'user' as const : 'assistant' as const,
                    content: m.text,
                }));
                messagesParam.push({ role: 'user' as const, content: message });

                const streamPromise = anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 1024,
                    messages: messagesParam,
                    stream: true,
                });

                const wrappedFactory = async () => {
                    const aStream = await streamPromise;
                    let resolveResponse: (value: any) => void;
                    const responsePromise = new Promise((resolve) => {
                        resolveResponse = resolve;
                    });

                    const asyncGenerator = async function* () {
                        let accumulatedText = '';
                        let inputTokens = 0;
                        let outputTokens = 0;
                        try {
                            for await (const event of aStream) {
                                if (event.type === 'message_start' && event.message.usage) {
                                    inputTokens = event.message.usage.input_tokens;
                                }
                                if (event.type === 'message_delta' && event.usage) {
                                    outputTokens = event.usage.output_tokens;
                                }
                                if (event.type === 'content_block_delta' && event.delta && event.delta.type === 'text_delta') {
                                    const text = event.delta.text;
                                    accumulatedText += text;
                                    yield {
                                        text: () => text,
                                    };
                                }
                            }
                        } finally {
                            const promptTokens = inputTokens || Math.round(message.length / 4);
                            const completionTokens = outputTokens || Math.round(accumulatedText.length / 4);
                            resolveResponse({
                                usageMetadata: {
                                    promptTokenCount: promptTokens,
                                    candidatesTokenCount: completionTokens,
                                    totalTokenCount: promptTokens + completionTokens,
                                },
                            });
                        }
                    };

                    return {
                        stream: asyncGenerator(),
                        response: responsePromise,
                    };
                };

                await LlmLoggerWrapper.wrapStreamCall(
                    {
                        sessionId,
                        model: 'claude-3-5-sonnet',
                        provider: 'Anthropic Claude',
                        message,
                        historyCount: messagesParam.length - 1,
                    },
                    wrappedFactory,
                    onChunk
                );
                return;
            } catch (err: any) {
                this.logger.error(`Real Anthropic connection failed: ${err.message}. Falling back to simulated stream.`);
                modelType = 'other';
            }
        }

        if (modelType === 'other') {
            this.logger.log("Running local Mock offline stream...");
            await this.simulateStream(
                'Mock Local Provider',
                'mock-offline-model',
                message,
                messages.length,
                sessionId,
                onChunk,
                `[Mock Offline Model Response]: Hello! I am a simulated offline model (mock-offline-model) hosted directly inside the backend. I stream back responses instantly without hitting any network services. You asked: "${message}". Your telemetry logs and metrics are fully captured in the database!`
            );
            return;
        }

        
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey || apiKey === 'your_actual_gemini_api_key_here' || apiKey.includes('your_') || apiKey === 'dummy-key') {
            this.logger.warn("Gemini API key missing or placeholder. Running Gemini simulated fallback.");
            await this.simulateStream(
                'Google Gemini',
                'gemini-2.0-flash',
                message,
                messages.length,
                sessionId,
                onChunk,
                `[Simulated Gemini Response]: Hello! I am Google's Gemini (gemini-2.0-flash) running in fallback mode because no valid GEMINI_API_KEY was configured in the backend environment. You asked: "${message}". Set a real Gemini key to enable live Google intelligence.`
            );
            return;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelCandidates = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
        let lastError: any = null;

        for (const modelName of modelCandidates) {
            try {
                this.logger.log(`Attempting to generate stream with model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });

                const history = messages.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                }));

                const chat = model.startChat({ history });

                await LlmLoggerWrapper.wrapStreamCall(
                    {
                        sessionId,
                        model: modelName,
                        provider: 'Google Gemini',
                        message,
                        historyCount: history.length,
                    },
                    () => chat.sendMessageStream(message),
                    onChunk
                );

                return;
            } catch (error: any) {
                this.logger.warn(`Model ${modelName} failed to stream: ${error.message}`);
                lastError = error;
            }
        }

        this.logger.error("All Gemini model candidates failed to stream. Falling back to Gemini simulation.");
        await this.simulateStream(
            'Google Gemini',
            'gemini-2.0-flash',
            message,
            messages.length,
            sessionId,
            onChunk,
            `[Simulated Gemini Response]: Hello! All live Gemini models failed to respond. I am running in fallback mode. You asked: "${message}".`
        );
    }

    private async simulateStream(
        provider: string,
        modelName: string,
        message: string,
        historyCount: number,
        sessionId: string | undefined,
        onChunk: (text: string) => void,
        fullResponseText: string
    ): Promise<void> {
        let resolveResponse: (value: any) => void;
        const responsePromise = new Promise((resolve) => {
            resolveResponse = resolve;
        });

        const words = fullResponseText.split(' ');
        const asyncGenerator = async function* () {
            let accumulatedText = '';
            try {
                for (const word of words) {
                    await new Promise((r) => setTimeout(r, 45));
                    const text = word + ' ';
                    accumulatedText += text;
                    yield {
                        text: () => text,
                    };
                }
            } finally {
                const promptTokens = Math.round(message.length / 4);
                const completionTokens = Math.round(accumulatedText.length / 4);
                resolveResponse({
                    usageMetadata: {
                        promptTokenCount: promptTokens,
                        candidatesTokenCount: completionTokens,
                        totalTokenCount: promptTokens + completionTokens,
                    },
                });
            }
        };

        await LlmLoggerWrapper.wrapStreamCall(
            {
                sessionId,
                model: modelName,
                provider,
                message,
                historyCount,
            },
            async () => ({
                stream: asyncGenerator(),
                response: responsePromise,
            }),
            onChunk
        );
    }
}
