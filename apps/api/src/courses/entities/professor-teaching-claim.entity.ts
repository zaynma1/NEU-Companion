import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { User } from '../../auth/entities/user.entity';
import type { CourseGroup } from './course-group.entity';

@Entity('professor_teaching_claims')
export class ProfessorTeachingClaim {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne('User', (professor: User) => professor.teachingClaims, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professor_id' })
  professor!: User;

  @Column({ type: 'uuid', name: 'professor_id' })
  professorId!: string;

  @ManyToOne('CourseGroup', (courseGroup: CourseGroup) => courseGroup.teachingClaims, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_group_id' })
  courseGroup!: CourseGroup;

  @Column({ type: 'uuid', name: 'course_group_id' })
  courseGroupId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'claimed_at' })
  claimedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'released_at' })
  releasedAt?: Date | null;
}
