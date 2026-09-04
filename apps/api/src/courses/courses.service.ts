import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { CourseGroup } from './entities/course-group.entity';

export interface ListCoursesQuery {
  term?: string;
  department?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseGroup)
    private readonly courseGroupRepository: Repository<CourseGroup>,
  ) {}

  async listCourses(query: ListCoursesQuery): Promise<Course[]> {
    const limit = query.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    const where: FindOptionsWhere<Course> = {};
    if (query.term) {
      where.term = query.term;
    }
    if (query.department) {
      where.department = query.department;
    }
    if (query.search) {
      where.courseCode = ILike(`%${query.search}%`);
    }

    return this.courseRepository.find({
      where,
      order: { courseCode: 'ASC', id: 'ASC' },
      take: limit,
      ...(query.cursor ? { skip: Number(query.cursor) || 0 } : {}),
    });
  }

  async getCourse(courseId: string): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { id: courseId },
      relations: { groups: true },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  async listGroups(courseId: string): Promise<CourseGroup[]> {
    const course = await this.courseRepository.findOne({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.courseGroupRepository.find({
      where: { courseId },
      order: { groupLabel: 'ASC', id: 'ASC' },
    });
  }
}
