import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { CourseGroup } from './course-group.entity';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  courseCode!: string;

  @Column({ type: 'varchar', length: 255 })
  term!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  department?: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @OneToMany('CourseGroup', (courseGroup: CourseGroup) => courseGroup.course)
  groups!: CourseGroup[];
}
