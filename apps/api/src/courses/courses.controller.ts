import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { EnrollmentService } from './enrollment.service';
import { CoursesService } from './courses.service';

@Controller('courses')
@UseGuards(AuthGuard)
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Get()
  listCourses(
    @Query('term') term?: string,
    @Query('department') department?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.coursesService.listCourses({
      term,
      department,
      search,
      limit: limit === undefined ? undefined : Number(limit),
      cursor,
    });
  }

  @Get(':courseId')
  getCourse(@Param('courseId') courseId: string) {
    return this.coursesService.getCourse(courseId);
  }

  @Get(':courseId/groups')
  listGroups(@Param('courseId') courseId: string) {
    return this.coursesService.listGroups(courseId);
  }

  @Get(':courseId/groups/:groupId/eligibility')
  getEligibility(
    @Req() req: any,
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.enrollmentService.getEligibility(req.user.id, courseId, groupId);
  }
}
