import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { EnrollmentService } from './enrollment.service';

class EnrollDto {
  course_group_id!: string;
}

@Controller()
@UseGuards(AuthGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Get('enrollments')
  listEnrollments(
    @Req() req: any,
    @Query('term') term?: string,
    @Query('status') status?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.enrollmentService.listEnrollments(req.user.id, term, status, includeArchived === 'true');
  }

  @Post('enrollments')
  enroll(@Req() req: any, @Body() body: EnrollDto) {
    return this.enrollmentService.enroll(req.user.id, body.course_group_id);
  }

  @Post('enrollments/:enrollmentId/drop')
  drop(@Req() req: any, @Param('enrollmentId') enrollmentId: string) {
    return this.enrollmentService.drop(req.user.id, enrollmentId);
  }

  @Post('enrollments/switch')
  switchGroup(@Req() req: any, @Body() body: { from_enrollment_id: string; to_course_group_id: string }) {
    return this.enrollmentService.switchGroup(req.user.id, body.from_enrollment_id, body.to_course_group_id);
  }

  @Get('students/me/courses')
  listActiveCourses(@Req() req: any) {
    return this.enrollmentService.listActiveCourses(req.user.id);
  }
}
