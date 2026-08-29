import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from '../../auth/entities/user.entity';
import type { Course } from '../../courses/entities/course.entity';

@Entity('muted_courses')
export class MutedCourse {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @PrimaryColumn({ type: 'uuid', name: 'course_id' })
  courseId!: string;

  @ManyToOne('Course', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course!: Course;
}
