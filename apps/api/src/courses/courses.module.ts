import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity';
import { CourseGroup } from './entities/course-group.entity';
import { Enrollment } from './entities/enrollment.entity';
import { ProfessorTeachingClaim } from './entities/professor-teaching-claim.entity';
import { ProfessorTeachingClaimController } from './professor-teaching-claim.controller';
import { ProfessorTeachingClaimService } from './professor-teaching-claim.service';

@Module({
  imports: [TypeOrmModule.forFeature([Course, CourseGroup, Enrollment, ProfessorTeachingClaim])],
  controllers: [ProfessorTeachingClaimController],
  providers: [ProfessorTeachingClaimService],
  exports: [ProfessorTeachingClaimService],
})
export class CoursesModule {}
