import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ProfessorTeachingClaim } from './entities/professor-teaching-claim.entity';

@Injectable()
export class ProfessorTeachingClaimService {
  constructor(
    @InjectRepository(ProfessorTeachingClaim)
    private readonly teachingClaimRepository: Repository<ProfessorTeachingClaim>,
  ) {}

  async findAll(professorId: string, status?: 'active' | 'released'): Promise<ProfessorTeachingClaim[]> {
    return this.teachingClaimRepository.find({
      where: {
        professorId,
        ...(status === 'active' ? { releasedAt: IsNull() } : {}),
        ...(status === 'released' ? { releasedAt: Not(IsNull()) } : {}),
      },
      order: { claimedAt: 'DESC', id: 'DESC' },
    });
  }
}
