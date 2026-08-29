import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { ImportBatch } from './import-batch.entity';

@Entity('import_row_errors')
export class ImportRowError {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne('ImportBatch', (batch: ImportBatch) => batch.rowErrors, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch!: ImportBatch;

  @Column({ type: 'uuid', name: 'import_batch_id' })
  importBatchId!: string;

  @Column({ type: 'integer', name: 'row_number' })
  rowNumber!: number;

  @Column({ type: 'text', name: 'field_name' })
  fieldName!: string;

  @Column({ type: 'text', name: 'error_reason' })
  errorReason!: string;
}
