import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity';
import { CourseGroup } from './entities/course-group.entity';
import { Enrollment } from './entities/enrollment.entity';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { SystemConfig } from '../auth/entities/system-config.entity';
import { User } from '../auth/entities/user.entity';
import { ProfessorTeachingClaim } from './entities/professor-teaching-claim.entity';
import { ProfessorTeachingClaimController } from './professor-teaching-claim.controller';
import { ProfessorTeachingClaimService } from './professor-teaching-claim.service';

@Module({
  imports: [TypeOrmModule.forFeature([Course, CourseGroup, Enrollment, ProfessorTeachingClaim, User, SystemConfig])],
  controllers: [CoursesController, EnrollmentController, ProfessorTeachingClaimController],
  providers: [CoursesService, EnrollmentService, ProfessorTeachingClaimService],
  exports: [ProfessorTeachingClaimService],
})
export class CoursesModule {}
