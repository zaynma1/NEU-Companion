import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { ImportBatch } from '../entities/import-batch.entity';
import { ImportRowError } from '../entities/import-row-error.entity';
import { DatasetVersion } from '../entities/dataset-version.entity';
import { OfficialEvent } from '../../timetable/entities/official-event.entity';
import { Course } from '../../courses/entities/course.entity';
import { CourseGroup } from '../../courses/entities/course-group.entity';
import { ApplyImportDto, RollbackImportDto } from '../dtos/import.dto';

interface ImportValidationResult {
  isValid: boolean;
  errors: Array<{ rowNumber: number; fieldName: string; errorReason: string }>;
  rowCount: number;
}

interface ImportDiff {
  addCount: number;
  updateCount: number;
  removeCount: number;
}

@Injectable()
export class AdminImportService {
  constructor(
    @InjectRepository(ImportBatch)
    private readonly importBatchRepository: Repository<ImportBatch>,
    @InjectRepository(ImportRowError)
    private readonly importRowErrorRepository: Repository<ImportRowError>,
    @InjectRepository(DatasetVersion)
    private readonly datasetVersionRepository: Repository<DatasetVersion>,
    @InjectRepository(OfficialEvent)
    private readonly officialEventRepository: Repository<OfficialEvent>,
    @InjectRepository(CourseGroup)
    private readonly courseGroupRepository: Repository<CourseGroup>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new import batch from an uploaded file
   */
  async uploadImport(
    userId: string,
    term: string,
    templateVersion: string,
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<ImportBatch> {
    // Calculate content hash for idempotency
    const contentHash = this.calculateHash(fileBuffer);

    // Check if this exact file was already applied for this term
    const existingApplied = await this.importBatchRepository.findOne({
      where: { term, contentHash, status: 'applied' },
    });

    if (existingApplied) {
      throw new ConflictException('This file has already been applied for this term');
    }

    // Create new batch
    const batch = this.importBatchRepository.create({
      term,
      uploadedById: userId,
      fileName,
      templateVersion,
      contentHash,
      status: 'validating',
      rowCount: 0,
    });

    const savedBatch = await this.importBatchRepository.save(batch);

    // Validate the import asynchronously
    this.validateImportAsync(savedBatch.id, fileBuffer).catch((err) => {
      // Log error but don't throw; batch remains in validating state
      console.error(`Import validation failed for batch ${savedBatch.id}:`, err);
    });

    return savedBatch;
  }

  /**
   * Validate import file contents (runs asynchronously)
   */
  private async validateImportAsync(batchId: string, fileBuffer: Buffer): Promise<void> {
    const result = await this.validateImportFile(fileBuffer);

    const batch = await this.importBatchRepository.findOne({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException(`Import batch ${batchId} not found`);
    }

    // Update batch with validation results
    batch.rowCount = result.rowCount;
    batch.status = result.isValid ? 'validated' : 'failed';
    await this.importBatchRepository.save(batch);

    // Store row errors if any
    if (result.errors.length > 0) {
      const errorEntities = result.errors.map((err) =>
        this.importRowErrorRepository.create({
          importBatchId: batchId,
          rowNumber: err.rowNumber,
          fieldName: err.fieldName,
          errorReason: err.errorReason,
        }),
      );
      await this.importRowErrorRepository.save(errorEntities);
    }
  }

  /**
   * Validate import file format and content
   */
  private async validateImportFile(fileBuffer: Buffer): Promise<ImportValidationResult> {
    // Stub validation: in production, would parse Excel/CSV and validate against schema
    // For now, accept any file with header row
    const errors: Array<{ rowNumber: number; fieldName: string; errorReason: string }> = [];

    // Example: check for duplicate rows, missing required fields, date format errors, etc.
    // This is a placeholder implementation

    return {
      isValid: errors.length === 0,
      errors,
      rowCount: 1, // Placeholder
    };
  }

  /**
   * Get import batch details
   */
  async getImportBatch(batchId: string): Promise<ImportBatch> {
    const batch = await this.importBatchRepository.findOne({
      where: { id: batchId },
      relations: ['uploadedBy', 'rowErrors'],
    });

    if (!batch) {
      throw new NotFoundException(`Import batch ${batchId} not found`);
    }

    return batch;
  }

  /**
   * List import batches with pagination
   */
  async listImportBatches(
    term?: string,
    status?: string,
    limit: number = 10,
    cursor?: string,
  ): Promise<{ batches: ImportBatch[]; nextCursor?: string }> {
    const queryBuilder = this.importBatchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.uploadedBy', 'user')
      .orderBy('batch.createdAt', 'DESC');

    if (term) {
      queryBuilder.andWhere('batch.term = :term', { term });
    }

    if (status) {
      queryBuilder.andWhere('batch.status = :status', { status });
    }

    if (cursor) {
      queryBuilder.andWhere('batch.createdAt < :cursor', { cursor });
    }

    const batches = await queryBuilder.take(limit + 1).getMany();
    const hasMore = batches.length > limit;

    return {
      batches: batches.slice(0, limit),
      nextCursor: hasMore ? batches[limit - 1].createdAt.toISOString() : undefined,
    };
  }

  /**
   * Get validation errors for a batch
   */
  async getImportErrors(batchId: string, limit: number = 100, cursor?: number): Promise<{
    errors: ImportRowError[];
    nextCursor?: number;
  }> {
    const batch = await this.importBatchRepository.findOne({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException(`Import batch ${batchId} not found`);
    }

    const queryBuilder = this.importRowErrorRepository
      .createQueryBuilder('error')
      .where('error.importBatchId = :batchId', { batchId })
      .orderBy('error.rowNumber', 'ASC');

    if (cursor) {
      queryBuilder.andWhere('error.rowNumber > :cursor', { cursor });
    }

    const errors = await queryBuilder.take(limit + 1).getMany();
    const hasMore = errors.length > limit;

    return {
      errors: errors.slice(0, limit),
      nextCursor: hasMore ? errors[limit - 1].rowNumber : undefined,
    };
  }

  /**
   * Calculate diff between current and proposed dataset
   */
  async getImportDiff(batchId: string): Promise<ImportDiff> {
    const batch = await this.importBatchRepository.findOne({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException(`Import batch ${batchId} not found`);
    }

    if (batch.status !== 'validated') {
      throw new BadRequestException('Import batch must be validated before diff can be calculated');
    }

    // Get current dataset for the term
    const currentDataset = await this.datasetVersionRepository.findOne({
      where: { term: batch.term, isCurrent: true },
    });

    // Stub diff calculation: in production, would parse import and compare to current events
    return {
      addCount: 0,
      updateCount: 0,
      removeCount: 0,
    };
  }

  /**
   * Apply (publish) an import as the current dataset for its term
   */
  async applyImport(batchId: string, userId: string, dto: ApplyImportDto): Promise<DatasetVersion> {
    const batch = await this.importBatchRepository.findOne({
      where: { id: batchId },
      relations: ['rowErrors'],
    });

    if (!batch) {
      throw new NotFoundException(`Import batch ${batchId} not found`);
    }

    if (batch.status !== 'validated') {
      throw new BadRequestException(`Import batch must be in validated state, current state: ${batch.status}`);
    }

    if (batch.rowErrors && batch.rowErrors.length > 0) {
      throw new BadRequestException(`Import batch has validation errors and cannot be applied`);
    }

    // Use transaction to ensure atomic dataset swap
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get previous current version
      const previousCurrent = await queryRunner.manager.findOne(DatasetVersion, {
        where: { term: batch.term, isCurrent: true },
      });

      // Create new dataset version
      const newVersion = queryRunner.manager.create(DatasetVersion, {
        term: batch.term,
        importBatchId: batchId,
        previousVersionId: previousCurrent?.id,
        isCurrent: true,
      });

      const savedVersion = await queryRunner.manager.save(newVersion);

      // Atomically swap current flag
      if (previousCurrent) {
        previousCurrent.isCurrent = false;
        await queryRunner.manager.save(previousCurrent);
      }

      // Update batch status
      batch.status = 'applied';
      batch.appliedAt = new Date();
      await queryRunner.manager.save(batch);

      await queryRunner.commitTransaction();

      return savedVersion;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Rollback to a previous dataset version
   */
  async rollbackImport(userId: string, dto: RollbackImportDto): Promise<DatasetVersion> {
    const targetVersion = await this.datasetVersionRepository.findOne({
      where: { id: dto.datasetVersionId, term: dto.term },
    });

    if (!targetVersion) {
      throw new NotFoundException(`Dataset version ${dto.datasetVersionId} not found for term ${dto.term}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get current version
      const currentVersion = await queryRunner.manager.findOne(DatasetVersion, {
        where: { term: dto.term, isCurrent: true },
      });

      if (!currentVersion) {
        throw new NotFoundException(`No current dataset version found for term ${dto.term}`);
      }

      // Deactivate current
      currentVersion.isCurrent = false;
      await queryRunner.manager.save(currentVersion);

      // Activate target
      targetVersion.isCurrent = true;
      await queryRunner.manager.save(targetVersion);

      // Create audit record by creating a linked version
      const rollbackVersion = queryRunner.manager.create(DatasetVersion, {
        term: dto.term,
        importBatchId: targetVersion.importBatchId,
        previousVersionId: currentVersion.id,
        isCurrent: true,
      });

      const savedRollback = await queryRunner.manager.save(rollbackVersion);

      await queryRunner.commitTransaction();

      return savedRollback;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * List dataset versions for a term
   */
  async listDatasetVersions(term: string, limit: number = 10, cursor?: string): Promise<{
    versions: DatasetVersion[];
    nextCursor?: string;
  }> {
    const queryBuilder = this.datasetVersionRepository
      .createQueryBuilder('version')
      .where('version.term = :term', { term })
      .orderBy('version.publishedAt', 'DESC');

    if (cursor) {
      queryBuilder.andWhere('version.publishedAt < :cursor', { cursor });
    }

    const versions = await queryBuilder.take(limit + 1).getMany();
    const hasMore = versions.length > limit;

    return {
      versions: versions.slice(0, limit),
      nextCursor: hasMore ? versions[limit - 1].publishedAt.toISOString() : undefined,
    };
  }

  /**
   * Get current dataset version for a term
   */
  async getCurrentDataset(term: string): Promise<DatasetVersion> {
    const version = await this.datasetVersionRepository.findOne({
      where: { term, isCurrent: true },
      relations: ['importBatch'],
    });

    if (!version) {
      throw new NotFoundException(`No current dataset version found for term ${term}`);
    }

    return version;
  }

  /**
   * Calculate SHA256 hash of file content for idempotency
   */
  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}
