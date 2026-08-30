import { describe, expect, it } from '@jest/globals';
import { Course } from './entities/course.entity';
import { CourseGroup } from './entities/course-group.entity';
import { Enrollment } from './entities/enrollment.entity';

describe('CoursesModule', () => {
  it('exposes the course catalog and enrollment entity definitions', () => {
    expect(Course).toBeDefined();
    expect(CourseGroup).toBeDefined();
    expect(Enrollment).toBeDefined();
  });
});
