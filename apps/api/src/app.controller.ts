import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): { status: string; message: string } {
    return {
      status: 'ok',
      message: 'NEU Companion API is running',
    };
  }

  @Get('health')
  async getHealth(): Promise<{ status: string; ok: boolean; timestamp: string; dependencies: Record<string, string> }> {
    const database = await this.checkDatabase();
    const redis = this.configService.get<string>('REDIS_HOST') ? 'configured' : 'not_configured';

    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      ok: database === 'connected',
      timestamp: new Date().toISOString(),
      dependencies: {
        database,
        redis,
      },
    };
  }

  @Get('ready')
  async getReady(): Promise<{ status: string; ok: boolean; timestamp: string; dependencies: Record<string, string> }> {
    const database = await this.checkDatabase();
    const redis = this.configService.get<string>('REDIS_HOST') ? 'configured' : 'not_configured';
    const isReady = database === 'connected';

    return {
      status: isReady ? 'ready' : 'degraded',
      ok: isReady,
      timestamp: new Date().toISOString(),
      dependencies: {
        database,
        redis,
      },
    };
  }

  private async checkDatabase(): Promise<'connected' | 'unavailable'> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'connected';
    } catch {
      return 'unavailable';
    }
  }
}
