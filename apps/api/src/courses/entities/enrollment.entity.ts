import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { forwardRef } from '@nestjs/common';
import { User } from '../../auth/entities/user.entity';
import { CourseGroup } from './course-group.entity';

@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @ManyToOne(() => forwardRef(() => CourseGroup), (courseGroup) => courseGroup.enrollments, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_group_id' })
  courseGroup!: CourseGroup;

  @Column({ type: 'uuid', name: 'course_group_id' })
  courseGroupId!: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status!: 'active' | 'dropped';

  @CreateDateColumn({ type: 'timestamptz', name: 'enrolled_at' })
  enrolledAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'dropped_at' })
  droppedAt?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  term?: string | null;
}
