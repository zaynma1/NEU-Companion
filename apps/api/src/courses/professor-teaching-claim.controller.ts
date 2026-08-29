import { Controller, Get } from '@nestjs/common';
import { ProfessorTeachingClaimService } from './professor-teaching-claim.service';

@Controller('api/v1/professor')
export class ProfessorTeachingClaimController {
  constructor(private readonly professorTeachingClaimService: ProfessorTeachingClaimService) {}

  @Get('teaching-claims')
  async findAll() {
    return this.professorTeachingClaimService.findAll();
  }
}
