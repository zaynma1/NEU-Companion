import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from './entities/import-batch.entity';
import { ImportRowError } from './entities/import-row-error.entity';
import { DatasetVersion } from './entities/dataset-version.entity';
import { AdminImportService } from './admin-import.service';
import { AdminImportController } from './admin-import.controller';
import { OfficialEvent } from '../timetable/entities/official-event.entity';
import { CourseGroup } from '../courses/entities/course-group.entity';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/entities/user.entity';
import { Session } from '../auth/entities/session.entity';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImportBatch,
      ImportRowError,
      DatasetVersion,
      OfficialEvent,
      CourseGroup,
      User,
      Session,
    ]),
  ],
  providers: [AdminImportService, AuthGuard, AuthService, RolesGuard],
  controllers: [AdminImportController],
  exports: [AdminImportService],
})
export class AdminModule {}
