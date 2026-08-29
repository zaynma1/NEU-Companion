import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { Course } from './course.entity';
import type { Enrollment } from './enrollment.entity';
import type { ProfessorTeachingClaim } from './professor-teaching-claim.entity';
import type { OfficialEvent } from '../../timetable/entities/official-event.entity';
import type { Announcement } from '../../notifications/entities/announcement.entity';

@Entity('course_groups')
@Unique(['course', 'groupLabel'])
export class CourseGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne('Course', (course: Course) => course.groups, { nullable: false, onDelete: 'CASCADE' })
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

  @OneToMany('Enrollment', (enrollment: Enrollment) => enrollment.courseGroup)
  enrollments!: Enrollment[];

  @OneToMany('ProfessorTeachingClaim', (teachingClaim: ProfessorTeachingClaim) => teachingClaim.courseGroup)
  teachingClaims!: ProfessorTeachingClaim[];

  @OneToMany('OfficialEvent', (officialEvent: OfficialEvent) => officialEvent.courseGroup)
  officialEvents!: OfficialEvent[];

  @OneToMany('Announcement', (announcement: Announcement) => announcement.courseGroup)
  announcements!: Announcement[];
}
