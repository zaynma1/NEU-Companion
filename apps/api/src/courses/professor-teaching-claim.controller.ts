import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ProfessorTeachingClaimService } from './professor-teaching-claim.service';

class CreateTeachingClaimDto {
  course_group_id!: string;
}

@Controller('professor')
@UseGuards(AuthGuard)
export class ProfessorTeachingClaimController {
  constructor(private readonly professorTeachingClaimService: ProfessorTeachingClaimService) {}

  @Get('teaching-claims')
  async findAll(@Req() req: any, @Query('status') status?: 'active' | 'released') {
    return this.professorTeachingClaimService.findAll(req.user.id, status);
  }

  @Post('teaching-claims')
  async create(@Req() req: any, @Body() body: CreateTeachingClaimDto) {
    return this.professorTeachingClaimService.createClaim(req.user.id, body.course_group_id);
  }

  @Delete('teaching-claims/:claimId')
  async release(@Req() req: any, @Param('claimId') claimId: string) {
    return this.professorTeachingClaimService.releaseClaim(req.user.id, claimId);
  }
}
