import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfficialEvent } from './entities/official-event.entity';
import { PersonalEvent } from './entities/personal-event.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { TimetableService } from './timetable.service';
import { TimetableController } from './timetable.controller';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/entities/user.entity';
import { Session } from '../auth/entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OfficialEvent, PersonalEvent, Enrollment, User, Session])],
  providers: [TimetableService, AuthGuard, AuthService],
  controllers: [TimetableController],
  exports: [TimetableService],
})
export class TimetableModule {}
