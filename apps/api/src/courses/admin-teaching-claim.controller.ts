import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProfessorTeachingClaimService } from './professor-teaching-claim.service';

class AdminTeachingClaimDto {
  professor_id!: string;
  course_group_id!: string;
  action!: 'assign' | 'revoke';
  reason!: string;
}

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminTeachingClaimController {
  constructor(private readonly teachingClaimService: ProfessorTeachingClaimService) {}

  @Post('teaching-claims')
  administer(@Req() req: any, @Body() body: AdminTeachingClaimDto) {
    return this.teachingClaimService.administerClaim(req.user.id, req.user.sessionId, {
      professorId: body.professor_id,
      courseGroupId: body.course_group_id,
      action: body.action,
      reason: body.reason,
    });
  }
}