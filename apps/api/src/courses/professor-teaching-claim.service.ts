import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { SystemConfig } from '../auth/entities/system-config.entity';
import { User } from '../auth/entities/user.entity';
import { CourseGroup } from './entities/course-group.entity';
import { ProfessorTeachingClaim } from './entities/professor-teaching-claim.entity';

export type TeachingClaimAction = 'assign' | 'revoke';

@Injectable()
export class ProfessorTeachingClaimService {
  constructor(
    @InjectRepository(ProfessorTeachingClaim)
    private readonly teachingClaimRepository: Repository<ProfessorTeachingClaim>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CourseGroup)
    private readonly courseGroupRepository: Repository<CourseGroup>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    private readonly authService: AuthService,
    private readonly dataSource: DataSource,
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

  async createClaim(professorId: string, courseGroupId: string): Promise<ProfessorTeachingClaim> {
    const professor = await this.loadActiveProfessor(professorId);
    const courseGroup = await this.loadActiveTermCourseGroup(courseGroupId);

    if (await this.findActiveClaim(courseGroupId)) {
      throw new ConflictException('teaching_claim.already_claimed');
    }

    let claim: ProfessorTeachingClaim;
    try {
      claim = await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(ProfessorTeachingClaim);
        return repository.save(
          repository.create({
            professor,
            professorId,
            courseGroup,
            courseGroupId,
            releasedAt: null,
          }),
        );
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('teaching_claim.already_claimed');
      }
      throw error;
    }

    await this.writeAudit('teaching_claim_created', claim.id, professorId, null, {
      professorId,
      courseGroupId,
    });
    return claim;
  }

  async releaseClaim(professorId: string, claimId: string): Promise<ProfessorTeachingClaim> {
    const claim = await this.teachingClaimRepository.findOne({ where: { id: claimId } });
    if (!claim) {
      throw new NotFoundException('Teaching claim not found');
    }
    if (claim.professorId !== professorId) {
      throw new ForbiddenException('You can only release your own teaching claims');
    }
    if (claim.releasedAt) {
      throw new ConflictException('teaching_claim.already_released');
    }

    const releasedAt = new Date();
    const result = await this.teachingClaimRepository.update(
      { id: claimId, professorId, releasedAt: IsNull() },
      { releasedAt },
    );
    if (result.affected !== 1) {
      throw new ConflictException('teaching_claim.already_released');
    }

    claim.releasedAt = releasedAt;
    await this.writeAudit('teaching_claim_released', claimId, professorId, {
      professorId: claim.professorId,
      courseGroupId: claim.courseGroupId,
      releasedAt: null,
    }, {
      professorId: claim.professorId,
      courseGroupId: claim.courseGroupId,
      releasedAt,
    });
    return claim;
  }

  async administerClaim(
    actorId: string,
    sessionId: string | undefined,
    input: {
      professorId: string;
      courseGroupId: string;
      action: TeachingClaimAction;
      reason: string;
    },
  ): Promise<ProfessorTeachingClaim> {
    if (!input.reason?.trim()) {
      throw new BadRequestException('Reason is required');
    }
    if (!sessionId) {
      throw new UnauthorizedException('Fresh step-up verification is required');
    }
    await this.authService.ensureFreshStepUp(sessionId);

    if (input.action === 'assign') {
      const professor = await this.loadActiveProfessor(input.professorId);
      const courseGroup = await this.loadActiveTermCourseGroup(input.courseGroupId);
      if (await this.findActiveClaim(input.courseGroupId)) {
        throw new ConflictException('teaching_claim.already_claimed');
      }

      let claim: ProfessorTeachingClaim;
      try {
        claim = await this.dataSource.transaction(async (manager) => {
          const repository = manager.getRepository(ProfessorTeachingClaim);
          return repository.save(
            repository.create({
              professor,
              professorId: input.professorId,
              courseGroup,
              courseGroupId: input.courseGroupId,
              releasedAt: null,
            }),
          );
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException('teaching_claim.already_claimed');
        }
        throw error;
      }

      await this.writeAudit('teaching_claim_assigned', claim.id, actorId, null, {
        professorId: input.professorId,
        courseGroupId: input.courseGroupId,
        reason: input.reason,
      });
      return claim;
    }

    if (input.action !== 'revoke') {
      throw new BadRequestException('Action must be assign or revoke');
    }

    const claim = await this.teachingClaimRepository.findOne({
      where: { professorId: input.professorId, courseGroupId: input.courseGroupId, releasedAt: IsNull() },
    });
    if (!claim) {
      throw new NotFoundException('Active teaching claim not found');
    }

    const releasedAt = new Date();
    const result = await this.teachingClaimRepository.update(
      { id: claim.id, professorId: input.professorId, courseGroupId: input.courseGroupId, releasedAt: IsNull() },
      { releasedAt },
    );
    if (result.affected !== 1) {
      throw new ConflictException('teaching_claim.already_released');
    }

    claim.releasedAt = releasedAt;
    await this.writeAudit('teaching_claim_revoked', claim.id, actorId, {
      professorId: claim.professorId,
      courseGroupId: claim.courseGroupId,
      releasedAt: null,
    }, {
      professorId: claim.professorId,
      courseGroupId: claim.courseGroupId,
      releasedAt,
      reason: input.reason,
    });
    return claim;
  }

  private async loadActiveProfessor(professorId: string): Promise<User> {
    const professor = await this.userRepository.findOne({ where: { id: professorId } });
    if (!professor || professor.role !== 'professor' || professor.accountStatus !== 'active') {
      throw new ForbiddenException('Only active professor accounts can manage teaching claims');
    }
    return professor;
  }

  private async loadActiveTermCourseGroup(courseGroupId: string): Promise<CourseGroup> {
    const courseGroup = await this.courseGroupRepository.findOne({
      where: { id: courseGroupId },
      relations: { course: true },
    });
    if (!courseGroup || !courseGroup.course) {
      throw new NotFoundException('Course group not found');
    }
    if (courseGroup.isArchived) {
      throw new BadRequestException('Course group is archived');
    }

    const activeTerm = await this.systemConfigRepository.findOne({ where: { key: 'active_term' } });
    if (!activeTerm?.value) {
      throw new BadRequestException('Active term is not configured');
    }
    if (courseGroup.course.term !== activeTerm.value) {
      throw new BadRequestException('Course group is outside the active term');
    }
    return courseGroup;
  }

  private findActiveClaim(courseGroupId: string) {
    return this.teachingClaimRepository.findOne({ where: { courseGroupId, releasedAt: IsNull() } });
  }

  private async writeAudit(
    actionType: string,
    targetId: string,
    actorId: string,
    beforeValue: Record<string, unknown> | null,
    afterValue: Record<string, unknown>,
  ): Promise<void> {
    await this.authService.writeAuditLog({
      actorId,
      actorLabelSnapshot: `user:${actorId}`,
      actionType,
      targetEntity: 'professor_teaching_claims',
      targetId,
      beforeValue,
      afterValue,
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  }
}
