import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Index, Unique } from 'typeorm';
import type { ImportBatch } from './import-batch.entity';
import type { OfficialEvent } from '../../timetable/entities/official-event.entity';

@Entity('dataset_versions')
@Index(['term', 'isCurrent'])
@Index(['publishedAt'])
export class DatasetVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  term!: string;

  @ManyToOne('ImportBatch', (batch: ImportBatch) => batch.datasetVersions, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch!: ImportBatch;

  @Column({ type: 'uuid', name: 'import_batch_id' })
  importBatchId!: string;

  @ManyToOne('DatasetVersion', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'previous_version_id' })
  previousVersion?: DatasetVersion | null;

  @Column({ type: 'uuid', nullable: true, name: 'previous_version_id' })
  previousVersionId?: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_current' })
  isCurrent!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'published_at' })
  publishedAt!: Date;

  @OneToMany('OfficialEvent', (event: OfficialEvent) => event.datasetVersion)
  officialEvents!: OfficialEvent[];
}
