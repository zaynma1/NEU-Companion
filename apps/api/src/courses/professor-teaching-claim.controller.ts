import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ProfessorTeachingClaimService } from './professor-teaching-claim.service';

@Controller('professor')
@UseGuards(AuthGuard)
export class ProfessorTeachingClaimController {
  constructor(private readonly professorTeachingClaimService: ProfessorTeachingClaimService) {}

  @Get('teaching-claims')
  async findAll(@Req() req: any, @Query('status') status?: 'active' | 'released') {
    return this.professorTeachingClaimService.findAll(req.user.id, status);
  }
}
