import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity';
import { CourseGroup } from './entities/course-group.entity';
import { Enrollment } from './entities/enrollment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Course, CourseGroup, Enrollment])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class CoursesModule {}
