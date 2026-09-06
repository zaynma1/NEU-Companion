import { describe, expect, it, jest } from '@jest/globals';
import { AdminTeachingClaimController } from './admin-teaching-claim.controller';
import { ProfessorTeachingClaimController } from './professor-teaching-claim.controller';

const mockFn = () => jest.fn<(...args: any[]) => any>();

describe('Teaching claim controllers', () => {
  it('forwards professor self-claim and release requests to the authenticated user', async () => {
    const service = {
      findAll: mockFn(),
      createClaim: mockFn().mockResolvedValue({ id: 'claim-1' }),
      releaseClaim: mockFn().mockResolvedValue({ id: 'claim-1' }),
    };
    const controller = new ProfessorTeachingClaimController(service as any);

    await controller.create({ user: { id: 'professor-1' } }, { course_group_id: 'group-1' });
    await controller.release({ user: { id: 'professor-1' } }, 'claim-1');

    expect(service.createClaim).toHaveBeenCalledWith('professor-1', 'group-1');
    expect(service.releaseClaim).toHaveBeenCalledWith('professor-1', 'claim-1');
  });

  it('forwards admin assignment or revocation with session and reason', async () => {
    const service = { administerClaim: mockFn().mockResolvedValue({ id: 'claim-1' }) };
    const controller = new AdminTeachingClaimController(service as any);

    await controller.administer(
      { user: { id: 'admin-1', sessionId: 'session-1' } },
      {
        professor_id: 'professor-1',
        course_group_id: 'group-1',
        action: 'revoke',
        reason: 'Administrative review decision',
      },
    );

    expect(service.administerClaim).toHaveBeenCalledWith('admin-1', 'session-1', {
      professorId: 'professor-1',
      courseGroupId: 'group-1',
      action: 'revoke',
      reason: 'Administrative review decision',
    });
  });
});
