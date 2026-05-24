import { Controller, Post, Body, BadRequestException, InternalServerErrorException, Res } from '@nestjs/common';
import * as express from 'express';
import { ChatService } from './chat.service';

interface ChatDto {
  message: string;
  messages: Array<{ role: 'user' | 'bot'; text: string }>;
  sessionId?: string;
  model?: string;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async handleChat(@Body() body: ChatDto) {
    const { message, messages, sessionId } = body;
    if (!message) {
      throw new BadRequestException('Message is required');
    }

    try {
      const text = await this.chatService.generateResponse(message, messages || [], sessionId);
      return { text };
    } catch (error: any) {
        console.log(error)
      throw new InternalServerErrorException(error.message);
    }
  }

  @Post('stream')
  async handleChatStream(@Body() body: ChatDto, @Res() res: express.Response) {
    const { message, messages, sessionId, model } = body;
    if (!message) {
      throw new BadRequestException('Message is required');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      await this.chatService.generateResponseStream(
        message,
        messages || [],
        model || 'gemini',
        (chunkText: string) => {
          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        },
        sessionId
      );

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error('Error in streaming endpoint:', error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
}
