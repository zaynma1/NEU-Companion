import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfficialEvent } from './entities/official-event.entity';
import { PersonalEvent } from './entities/personal-event.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { TimetableService } from './timetable.service';
import { TimetableController } from './timetable.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([OfficialEvent, PersonalEvent, Enrollment])],
  providers: [TimetableService],
  controllers: [TimetableController],
  exports: [TimetableService],
})
export class TimetableModule {}
