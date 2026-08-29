import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { forwardRef } from '@nestjs/common';
import { Course } from './course.entity';
import { Enrollment } from './enrollment.entity';

@Entity('course_groups')
@Unique(['course', 'groupLabel'])
export class CourseGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => forwardRef(() => Course), (course) => course.groups, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course!: Course;

  @Column({ type: 'uuid', name: 'course_id' })
  courseId!: string;

  @Column({ type: 'varchar', length: 255, name: 'group_label' })
  groupLabel!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'professor_raw_name' })
  professorRawName?: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_archived' })
  isArchived!: boolean;

  @OneToMany(() => forwardRef(() => Enrollment), (enrollment) => enrollment.courseGroup)
  enrollments!: Enrollment[];
}
