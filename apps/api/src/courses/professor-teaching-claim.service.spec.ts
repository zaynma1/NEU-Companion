import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ProfessorTeachingClaimService } from './professor-teaching-claim.service';

const mockFn = () => jest.fn<(...args: any[]) => any>();

describe('ProfessorTeachingClaimService', () => {
  let service: ProfessorTeachingClaimService;
  let teachingClaimRepository: any;
  let userRepository: any;
  let courseGroupRepository: any;
  let systemConfigRepository: any;
  let authService: any;
  let dataSource: any;
  const professor = { id: 'professor-1', role: 'professor', accountStatus: 'active' };
  const group = {
    id: 'group-1',
    courseId: 'course-1',
    isArchived: false,
    course: { id: 'course-1', term: '2026-fall' },
  };

  beforeEach(() => {
    teachingClaimRepository = {
      find: mockFn().mockResolvedValue([]),
      findOne: mockFn().mockResolvedValue(null),
      update: mockFn().mockResolvedValue({ affected: 1 }),
    };
    userRepository = { findOne: mockFn().mockResolvedValue(professor) };
    courseGroupRepository = { findOne: mockFn().mockResolvedValue(group) };
    systemConfigRepository = { findOne: mockFn().mockResolvedValue({ key: 'active_term', value: '2026-fall' }) };
    authService = {
      ensureFreshStepUp: mockFn().mockResolvedValue(undefined),
      writeAuditLog: mockFn().mockResolvedValue({}),
    };
    const transactionRepository = {
      create: jest.fn((value: any) => ({ id: 'claim-1', ...value })),
      save: jest.fn((value: any) => Promise.resolve(value)),
    };
    dataSource = {
      transaction: jest.fn(async (callback: any) => callback({ getRepository: () => transactionRepository })),
    };
    service = new ProfessorTeachingClaimService(
      teachingClaimRepository,
      userRepository,
      courseGroupRepository,
      systemConfigRepository,
      authService,
      dataSource,
    );
  });

  it('scopes claims to the authenticated professor and orders newest first', async () => {
    await service.findAll('professor-1', 'active');

    expect(teachingClaimRepository.find).toHaveBeenCalledWith({
      where: { professorId: 'professor-1', releasedAt: expect.anything() },
      order: { claimedAt: 'DESC', id: 'DESC' },
    });
  });

  it('allows an active professor to self-claim an active-term group', async () => {
    const claim = await service.createClaim('professor-1', 'group-1');

    expect(claim).toMatchObject({ professorId: 'professor-1', courseGroupId: 'group-1', releasedAt: null });
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(authService.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'teaching_claim_created',
      targetEntity: 'professor_teaching_claims',
    }));
  });

  it('rejects non-professors and inactive professors', async () => {
    userRepository.findOne.mockResolvedValueOnce({ ...professor, role: 'student' });
    await expect(service.createClaim('student-1', 'group-1')).rejects.toBeInstanceOf(ForbiddenException);

    userRepository.findOne.mockResolvedValueOnce({ ...professor, accountStatus: 'suspended' });
    await expect(service.createClaim('professor-1', 'group-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps an existing active claim to the documented conflict', async () => {
    teachingClaimRepository.findOne.mockResolvedValueOnce({ id: 'existing', releasedAt: null });

    await expect(service.createClaim('professor-1', 'group-1')).rejects.toThrow('teaching_claim.already_claimed');
  });

  it('releases only the owner claim with a conditional update', async () => {
    const claim = { id: 'claim-1', professorId: 'professor-1', courseGroupId: 'group-1', releasedAt: null };
    teachingClaimRepository.findOne.mockResolvedValue(claim);

    const released = await service.releaseClaim('professor-1', 'claim-1');

    expect(teachingClaimRepository.update).toHaveBeenCalledWith(
      { id: 'claim-1', professorId: 'professor-1', releasedAt: expect.anything() },
      { releasedAt: expect.any(Date) },
    );
    expect(released.releasedAt).toEqual(expect.any(Date));
    expect(authService.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'teaching_claim_released',
    }));
  });

  it('rejects release by another professor', async () => {
    teachingClaimRepository.findOne.mockResolvedValue({ id: 'claim-1', professorId: 'other', releasedAt: null });

    await expect(service.releaseClaim('professor-1', 'claim-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps a concurrent release that updates zero rows to a conflict', async () => {
    teachingClaimRepository.findOne.mockResolvedValue({ id: 'claim-1', professorId: 'professor-1', releasedAt: null });
    teachingClaimRepository.update.mockResolvedValue({ affected: 0 });

    await expect(service.releaseClaim('professor-1', 'claim-1')).rejects.toThrow('teaching_claim.already_released');
  });

  it('requires fresh step-up for admin mutations', async () => {
    await expect(service.administerClaim('admin-1', undefined, {
      professorId: 'professor-1',
      courseGroupId: 'group-1',
      action: 'assign',
      reason: 'Administrative review decision',
    })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.ensureFreshStepUp).not.toHaveBeenCalled();
  });

  it('assigns a claim and records the administrative reason', async () => {
    const claim = await service.administerClaim('admin-1', 'session-1', {
      professorId: 'professor-1',
      courseGroupId: 'group-1',
      action: 'assign',
      reason: 'Administrative review decision',
    });

    expect(claim.professorId).toBe('professor-1');
    expect(authService.ensureFreshStepUp).toHaveBeenCalledWith('session-1');
    expect(authService.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'teaching_claim_assigned',
      afterValue: expect.objectContaining({ reason: 'Administrative review decision' }),
    }));
  });
});
