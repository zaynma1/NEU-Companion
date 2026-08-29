import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Course } from '../../courses/entities/course.entity';
import type { CourseGroup } from '../../courses/entities/course-group.entity';
import type { User } from '../../auth/entities/user.entity';
import type { Notification } from './notification.entity';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne('Course', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course!: Course;

  @Column({ type: 'uuid', name: 'course_id' })
  courseId!: string;

  @ManyToOne('CourseGroup', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_group_id' })
  courseGroup!: CourseGroup;

  @Column({ type: 'uuid', name: 'course_group_id' })
  courseGroupId!: string;

  @ManyToOne('User', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'professor_id' })
  professor!: User;

  @Column({ type: 'uuid', name: 'professor_id' })
  professorId!: string;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'published_at' })
  publishedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'expiry_at' })
  expiryAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany('Notification', (notification: Notification) => notification.announcement)
  notifications!: Notification[];
}
