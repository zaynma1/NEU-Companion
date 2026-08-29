import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { CourseGroup } from '../../courses/entities/course-group.entity';
import type { DatasetVersion } from '../../admin/entities/dataset-version.entity';

@Entity('official_events')
export class OfficialEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne('DatasetVersion', (datasetVersion: DatasetVersion) => datasetVersion.officialEvents, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dataset_version_id' })
  datasetVersion!: DatasetVersion;

  @Column({ type: 'uuid', name: 'dataset_version_id' })
  datasetVersionId!: string;

  @ManyToOne('CourseGroup', (courseGroup: CourseGroup) => courseGroup.officialEvents, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_group_id' })
  courseGroup!: CourseGroup;

  @Column({ type: 'uuid', name: 'course_group_id' })
  courseGroupId!: string;

  @Column({ type: 'varchar', length: 32 })
  eventType!: 'lecture' | 'exam';

  @Column({ type: 'timestamptz', name: 'start_datetime' })
  startDatetime!: Date;

  @Column({ type: 'timestamptz', name: 'end_datetime' })
  endDatetime!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string | null;
}
