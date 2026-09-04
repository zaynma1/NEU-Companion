import { describe, expect, it, jest } from '@jest/globals';
import { ProfessorTeachingClaimService } from './professor-teaching-claim.service';


describe('ProfessorTeachingClaimService', () => {
  it('scopes claims to the authenticated professor and orders newest first', async () => {
    const repository = { find: jest.fn().mockResolvedValue([]) };
    const service = new ProfessorTeachingClaimService(repository as any);

    await service.findAll('professor-1', 'active');

    expect(repository.find).toHaveBeenCalledWith({
      where: { professorId: 'professor-1', releasedAt: expect.anything() },
      order: { claimedAt: 'DESC', id: 'DESC' },
    });
  });
});
