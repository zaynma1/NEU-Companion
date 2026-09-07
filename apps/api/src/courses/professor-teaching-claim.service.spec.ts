import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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
  let transactionRepository: any;
  const professor = { id: 'professor-1', role: 'professor', accountStatus: 'active' };
  const group = {
    id: 'group-1',
    courseId: 'course-1',
    isArchived: false,
    professorRawName: 'Imported Professor Name',
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
    transactionRepository = {
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
    expect(transactionRepository.create).toHaveBeenCalledWith(expect.objectContaining({ releasedAt: null }));
    expect(group.professorRawName).toBe('Imported Professor Name');
  });

  it.each([
    ['student', 'active'],
    ['professor', 'pending'],
    ['professor', 'suspended'],
    ['professor', 'blocked'],
  ])('rejects %s accounts with status %s', async (role, accountStatus) => {
    userRepository.findOne.mockResolvedValueOnce({ ...professor, role, accountStatus });

    await expect(service.createClaim('professor-1', 'group-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(courseGroupRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects a missing group', async () => {
    courseGroupRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.createClaim('professor-1', 'missing-group')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects archived groups', async () => {
    courseGroupRepository.findOne.mockResolvedValueOnce({ ...group, isArchived: true });

    await expect(service.createClaim('professor-1', 'group-1')).rejects.toThrow('Course group is archived');
  });

  it('rejects groups outside the active term', async () => {
    courseGroupRepository.findOne.mockResolvedValueOnce({
      ...group,
      course: { ...group.course, term: '2026-spring' },
    });

    await expect(service.createClaim('professor-1', 'group-1')).rejects.toThrow('Course group is outside the active term');
  });

  it('rejects when active_term is not configured', async () => {
    systemConfigRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.createClaim('professor-1', 'group-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps an existing active claim to the documented conflict', async () => {
    teachingClaimRepository.findOne.mockResolvedValueOnce({ id: 'existing', releasedAt: null });

    await expect(service.createClaim('professor-1', 'group-1')).rejects.toThrow('teaching_claim.already_claimed');
  });

  it('maps a database uniqueness violation to the documented conflict', async () => {
    teachingClaimRepository.findOne.mockResolvedValueOnce(null);
    dataSource.transaction.mockRejectedValueOnce({ code: '23505' });

    await expect(service.createClaim('professor-1', 'group-1')).rejects.toEqual(
      expect.objectContaining({ message: 'teaching_claim.already_claimed' }),
    );
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

  it('rejects a missing claim and an already-released claim', async () => {
    teachingClaimRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.releaseClaim('professor-1', 'missing-claim')).rejects.toBeInstanceOf(NotFoundException);

    teachingClaimRepository.findOne.mockResolvedValueOnce({
      id: 'claim-1',
      professorId: 'professor-1',
      releasedAt: new Date(),
    });
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

  it('rejects an administrative mutation without a reason', async () => {
    await expect(service.administerClaim('admin-1', 'session-1', {
      professorId: 'professor-1',
      courseGroupId: 'group-1',
      action: 'assign',
      reason: '   ',
    })).rejects.toThrow('Reason is required');
    expect(authService.ensureFreshStepUp).not.toHaveBeenCalled();
  });

  it('rejects administrative assignment for an already claimed group', async () => {
    teachingClaimRepository.findOne.mockResolvedValueOnce({ id: 'existing', releasedAt: null });

    await expect(service.administerClaim('admin-1', 'session-1', {
      professorId: 'professor-1',
      courseGroupId: 'group-1',
      action: 'assign',
      reason: 'Administrative review decision',
    })).rejects.toThrow('teaching_claim.already_claimed');
  });

  it.each([
    ['student', 'active'],
    ['professor', 'pending'],
    ['professor', 'suspended'],
    ['professor', 'blocked'],
  ])('rejects administrative assignment for %s accounts with status %s', async (role, accountStatus) => {
    userRepository.findOne.mockResolvedValueOnce({ ...professor, role, accountStatus });

    await expect(service.administerClaim('admin-1', 'session-1', {
      professorId: 'professor-1',
      courseGroupId: 'group-1',
      action: 'assign',
      reason: 'Administrative review decision',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('revokes an active assignment and records the audit reason', async () => {
    const claim = { id: 'claim-1', professorId: 'professor-1', courseGroupId: 'group-1', releasedAt: null };
    teachingClaimRepository.findOne.mockResolvedValueOnce(claim);

    const revoked = await service.administerClaim('admin-1', 'session-1', {
      professorId: 'professor-1',
      courseGroupId: 'group-1',
      action: 'revoke',
      reason: 'Administrative review decision',
    });

    expect(revoked.releasedAt).toEqual(expect.any(Date));
    expect(authService.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'teaching_claim_revoked',
      afterValue: expect.objectContaining({ reason: 'Administrative review decision' }),
    }));
  });

  it('rejects revocation when no active assignment exists', async () => {
    teachingClaimRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.administerClaim('admin-1', 'session-1', {
      professorId: 'professor-1',
      courseGroupId: 'group-1',
      action: 'revoke',
      reason: 'Administrative review decision',
    })).rejects.toBeInstanceOf(NotFoundException);
  });
});
