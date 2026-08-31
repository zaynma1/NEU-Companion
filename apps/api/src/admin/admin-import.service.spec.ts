import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AdminImportService } from './admin-import.service';

describe('AdminImportService', () => {
  let service: AdminImportService;
  let importBatchRepository: any;
  let importRowErrorRepository: any;
  let datasetVersionRepository: any;
  let officialEventRepository: any;
  let courseGroupRepository: any;
  let dataSource: any;

  beforeEach(() => {
    importBatchRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (entity) => entity),
      create: jest.fn((entity) => entity),
    };

    importRowErrorRepository = {
      delete: jest.fn(async () => undefined),
    };

    datasetVersionRepository = {};
    officialEventRepository = {};
    courseGroupRepository = {};
    dataSource = {};

    service = new AdminImportService(
      importBatchRepository,
      importRowErrorRepository,
      datasetVersionRepository,
      officialEventRepository,
      courseGroupRepository,
      dataSource,
    );
  });

  it('should reset a failed import batch to validating and clear stored row errors', async () => {
    const batch = {
      id: 'batch-1',
      term: 'Fall 2026',
      status: 'failed',
      rowCount: 12,
      uploadedById: 'user-123',
      fileName: 'old-file.xlsx',
      templateVersion: 'v1',
      contentHash: 'old-hash',
      rowErrors: [{ id: 'error-1' }],
    };

    importBatchRepository.findOne.mockResolvedValue(batch);

    const result = await service.retryImport('batch-1', 'user-123', Buffer.from('new file'), 'new-file.xlsx');

    expect(importRowErrorRepository.delete).toHaveBeenCalledWith({ importBatchId: 'batch-1' });
    expect(result.status).toBe('validating');
    expect(result.fileName).toBe('new-file.xlsx');
    expect(result.contentHash).toBeDefined();
    expect(result.rowCount).toBe(0);
  });

  it('should reject retries for batches that are not failed', async () => {
    const batch = {
      id: 'batch-2',
      term: 'Spring 2027',
      status: 'validated',
      rowCount: 3,
      uploadedById: 'user-123',
      fileName: 'valid.xlsx',
      templateVersion: 'v1',
      contentHash: 'hash-2',
      rowErrors: [],
    };

    importBatchRepository.findOne.mockResolvedValue(batch);

    await expect(service.retryImport('batch-2', 'user-123')).rejects.toThrow('Import batch must be in failed state');
  });
});
