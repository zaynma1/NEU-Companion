import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getExpressTrustProxySetting, resolveCorsOrigin, validateRuntimeEnvironment } from './config/runtime.config';
import { CsrfMiddleware } from './auth/csrf.middleware';
import { AuthService } from './auth/auth.service';

const cookieParser = require('cookie-parser');

async function bootstrap() {
  validateRuntimeEnvironment();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.getHttpAdapter().getInstance().set('trust proxy', getExpressTrustProxySetting());
  const port = Number(process.env.PORT ?? 3000);

  console.log(
    `[bootstrap] Starting API on port=${port}, nodeEnv=${process.env.NODE_ENV ?? 'unknown'}, googleClientConfigured=${Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}, redirectUri=${process.env.GOOGLE_REDIRECT_URI ?? '<unset>'}`,
  );

  app.enableCors({
    origin: (requestOrigin, callback) => callback(null, resolveCorsOrigin(requestOrigin)),
    credentials: true,
  });
  app.use(cookieParser(process.env.DEVICE_COOKIE_SECRET ?? 'local-device-cookie-secret'));
  const csrfMiddleware = new CsrfMiddleware(app.get(AuthService));
  app.use(csrfMiddleware.use.bind(csrfMiddleware));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  try {
    await app.listen(port);
    console.log(`[bootstrap] App listening at http://localhost:${port}`);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    console.error(
      `[bootstrap] Failed to bind to port ${port}: code=${err.code ?? 'unknown'}, message=${err.message}`,
    );
    console.error(`[bootstrap] Port ${port} is already in use. Check for a stale Node process before restarting.`);
    process.exit(1);
  }
}

bootstrap();
