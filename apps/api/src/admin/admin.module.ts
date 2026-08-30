import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from './entities/import-batch.entity';
import { ImportRowError } from './entities/import-row-error.entity';
import { DatasetVersion } from './entities/dataset-version.entity';
import { AdminImportService } from './admin-import.service';
import { AdminImportController } from './admin-import.controller';
import { OfficialEvent } from '../timetable/entities/official-event.entity';
import { CourseGroup } from '../courses/entities/course-group.entity';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ImportBatch,
      ImportRowError,
      DatasetVersion,
      OfficialEvent,
      CourseGroup,
    ]),
  ],
  providers: [AdminImportService, RolesGuard],
  controllers: [AdminImportController],
  exports: [AdminImportService],
})
export class AdminModule {}
