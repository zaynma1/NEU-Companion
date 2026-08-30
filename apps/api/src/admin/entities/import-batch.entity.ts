import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Index } from 'typeorm';
import type { User } from '../../auth/entities/user.entity';
import type { ImportRowError } from './import-row-error.entity';
import type { DatasetVersion } from './dataset-version.entity';

@Entity('import_batches')
@Index(['term', 'createdAt'])
@Index(['uploadedBy', 'createdAt'])
@Index(['status', 'createdAt'])
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  term!: string;

  @ManyToOne('User', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy!: User;

  @Column({ type: 'uuid', name: 'uploaded_by' })
  uploadedById!: string;

  @Column({ type: 'text', name: 'file_name' })
  fileName!: string;

  @Column({ type: 'text', name: 'template_version' })
  templateVersion!: string;

  @Column({ type: 'text', name: 'content_hash' })
  contentHash!: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'validating',
    enum: ['validating', 'validated', 'failed', 'applied', 'rolled_back', 'expired'],
  })
  status!: 'validating' | 'validated' | 'failed' | 'applied' | 'rolled_back' | 'expired';

  @Column({ type: 'integer', nullable: true, name: 'row_count' })
  rowCount?: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'applied_at' })
  appliedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'expired_at' })
  expiredAt?: Date | null;

  @OneToMany('ImportRowError', (error: ImportRowError) => error.importBatch, { cascade: true })
  rowErrors!: ImportRowError[];

  @OneToMany('DatasetVersion', (version: DatasetVersion) => version.importBatch)
  datasetVersions!: DatasetVersion[];
}
