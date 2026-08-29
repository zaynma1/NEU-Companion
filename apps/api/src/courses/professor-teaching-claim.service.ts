import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfessorTeachingClaim } from './entities/professor-teaching-claim.entity';

@Injectable()
export class ProfessorTeachingClaimService {
  constructor(
    @InjectRepository(ProfessorTeachingClaim)
    private readonly teachingClaimRepository: Repository<ProfessorTeachingClaim>,
  ) {}

  async findAll(): Promise<ProfessorTeachingClaim[]> {
    return this.teachingClaimRepository.find();
  }
}
