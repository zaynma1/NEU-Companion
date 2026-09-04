import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../auth/entities/system-config.entity';
import { User } from '../auth/entities/user.entity';
import { CourseGroup } from './entities/course-group.entity';
import { Enrollment } from './entities/enrollment.entity';

@Injectable()
export class EnrollmentService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(CourseGroup)
    private readonly courseGroupRepository: Repository<CourseGroup>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
  ) {}

  async listEnrollments(studentId: string, term?: string, status?: string, includeArchived = false): Promise<Enrollment[]> {
    return this.enrollmentRepository.find({
      where: {
        studentId,
        ...(term ? { term } : {}),
        ...(status ? { status: status as Enrollment['status'] } : {}),
        ...(!includeArchived && !status ? { status: 'active' } : {}),
      },
      relations: { courseGroup: { course: true } },
      order: { enrolledAt: 'DESC', id: 'DESC' },
    });
  }

  async enroll(studentId: string, courseGroupId: string): Promise<Enrollment> {
    const student = await this.userRepository.findOne({ where: { id: studentId } });
    if (!student || student.role !== 'student' || student.accountStatus !== 'active') {
      throw new UnauthorizedException('Only active student accounts can enroll');
    }

    const group = await this.courseGroupRepository.findOne({
      where: { id: courseGroupId },
      relations: { course: true },
    });
    if (!group || !group.course) {
      throw new NotFoundException('Course group not found');
    }
    if (group.isArchived) {
      throw new BadRequestException('Course group is archived');
    }

    const activeTerm = await this.getActiveTerm();
    if (group.course.term !== activeTerm) {
      throw new BadRequestException('Course group is outside the active term');
    }

    const existing = await this.enrollmentRepository.findOne({
      where: { studentId, courseGroupId, term: group.course.term, status: 'active' },
    });
    if (existing) {
      throw new ConflictException('Already enrolled in this course group');
    }

    return this.enrollmentRepository.save(
      this.enrollmentRepository.create({
        student,
        studentId,
        courseGroup: group,
        courseGroupId,
        status: 'active',
        term: group.course.term,
      }),
    );
  }

  async drop(studentId: string, enrollmentId: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentRepository.findOne({ where: { id: enrollmentId, studentId } });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    if (enrollment.status !== 'active') {
      throw new BadRequestException('Enrollment is not active');
    }

    enrollment.status = 'dropped';
    enrollment.droppedAt = new Date();
    return this.enrollmentRepository.save(enrollment);
  }

  async switchGroup(studentId: string, fromEnrollmentId: string, toCourseGroupId: string): Promise<Enrollment> {
    const source = await this.enrollmentRepository.findOne({
      where: { id: fromEnrollmentId, studentId },
      relations: { courseGroup: { course: true } },
    });
    if (!source) {
      throw new NotFoundException('Enrollment not found');
    }
    if (source.status !== 'active') {
      throw new BadRequestException('Enrollment is not active');
    }

    const target = await this.courseGroupRepository.findOne({
      where: { id: toCourseGroupId },
      relations: { course: true },
    });
    if (!target || !target.course) {
      throw new NotFoundException('Target course group not found');
    }
    if (target.isArchived) {
      throw new BadRequestException('Course group is archived');
    }
    if (target.courseId !== source.courseGroup.courseId || target.course.term !== source.term) {
      throw new BadRequestException('Target group must belong to the same course and term');
    }
    if (target.id === source.courseGroupId) {
      throw new ConflictException('Already enrolled in this course group');
    }
    if (target.course.term !== await this.getActiveTerm()) {
      throw new BadRequestException('Course group is outside the active term');
    }

    const duplicate = await this.enrollmentRepository.findOne({
      where: { studentId, courseGroupId: target.id, term: target.course.term, status: 'active' },
    });
    if (duplicate) {
      throw new ConflictException('Already enrolled in this course group');
    }

    source.status = 'dropped';
    source.droppedAt = new Date();
    await this.enrollmentRepository.save(source);
    return this.enrollmentRepository.save(
      this.enrollmentRepository.create({
        studentId,
        courseGroup: target,
        courseGroupId: target.id,
        status: 'active',
        term: target.course.term,
      }),
    );
  }

  async getEligibility(studentId: string, courseId: string, groupId: string) {
    const student = await this.userRepository.findOne({ where: { id: studentId } });
    if (!student || student.role !== 'student' || student.accountStatus !== 'active') {
      return { eligible: false, reason: 'not_student_account' };
    }

    const group = await this.courseGroupRepository.findOne({
      where: { id: groupId, courseId },
      relations: { course: true },
    });
    if (!group || !group.course) {
      throw new NotFoundException('Course group not found');
    }
    if (group.isArchived) {
      return { eligible: false, reason: 'group_archived' };
    }
    if (group.course.term !== await this.getActiveTerm()) {
      return { eligible: false, reason: 'term_inactive' };
    }

    const existing = await this.enrollmentRepository.findOne({
      where: { studentId, courseGroupId: groupId, term: group.course.term, status: 'active' },
    });
    return existing
      ? { eligible: false, reason: 'already_enrolled' }
      : { eligible: true, reason: null };
  }

  async listActiveCourses(studentId: string): Promise<Enrollment[]> {
    return this.listEnrollments(studentId, undefined, 'active');
  }

  private async getActiveTerm(): Promise<string> {
    const config = await this.systemConfigRepository.findOne({ where: { key: 'active_term' } });
    if (!config?.value) {
      throw new BadRequestException('Active term is not configured');
    }
    return config.value;
  }
}
