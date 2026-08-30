import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('professor_schedule_documents')
export class ProfessorScheduleDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne('User', (user: User) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professor_id' })
  professor!: User;

  @Column({ type: 'uuid', unique: true, name: 'professor_id' })
  professorId!: string;

  @Column({ type: 'varchar', length: 2048, nullable: true, name: 'file_url' })
  fileUrl?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'mime_type' })
  mimeType?: string | null;

  @Column({ type: 'bigint', nullable: true, name: 'file_size_bytes' })
  fileSizeBytes?: number | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'uploaded_at' })
  uploadedAt?: Date | null;

  @Column({ type: 'text', nullable: true, name: 'office_hours_summary' })
  officeHoursSummary?: string | null;
}
