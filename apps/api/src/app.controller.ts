import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello(): { status: string; message: string } {
    return {
      status: 'ok',
      message: 'NEU Companion API is running',
    };
  }
}
