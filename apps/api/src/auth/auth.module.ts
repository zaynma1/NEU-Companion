import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthAttempt } from './entities/auth-attempt.entity';
import { Challenge } from './entities/challenge.entity';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session, AuthAttempt, Challenge])],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
