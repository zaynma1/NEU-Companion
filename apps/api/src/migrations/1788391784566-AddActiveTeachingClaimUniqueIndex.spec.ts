import { describe, expect, it, jest } from '@jest/globals';
import { AddActiveTeachingClaimUniqueIndex1788391784566 } from './1788391784566-AddActiveTeachingClaimUniqueIndex';

describe('AddActiveTeachingClaimUniqueIndex1788391784566', () => {
  it('creates a partial unique index for active claims only', async () => {
    const query = jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined);
    const migration = new AddActiveTeachingClaimUniqueIndex1788391784566();

    await migration.up({ query } as any);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('CREATE UNIQUE INDEX'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('("course_group_id")'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE "released_at" IS NULL'));
  });

  it('drops the active-claim index on rollback', async () => {
    const query = jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined);
    const migration = new AddActiveTeachingClaimUniqueIndex1788391784566();

    await migration.down({ query } as any);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('DROP INDEX'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('IDX_professor_teaching_claims_active_group'));
  });
});
