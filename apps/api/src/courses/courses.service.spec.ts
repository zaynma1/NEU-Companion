import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { CoursesService } from './courses.service';

function createService() {
  const courseRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const courseGroupRepository = {
    find: jest.fn(),
  };

  return {
    service: new CoursesService(courseRepository as any, courseGroupRepository as any),
    courseRepository,
    courseGroupRepository,
  };
}

describe('CoursesService', () => {
  it('lists filtered courses with a bounded limit and stable ordering', async () => {
    const { service, courseRepository } = createService();
    courseRepository.find.mockResolvedValue([]);

    await service.listCourses({ term: '2026-fall', department: 'CS', search: 'CS101', limit: 10 });

    expect(courseRepository.find).toHaveBeenCalledWith({
      where: { term: '2026-fall', department: 'CS', courseCode: expect.anything() },
      order: { courseCode: 'ASC', id: 'ASC' },
      take: 10,
    });
  });

  it('rejects invalid catalog limits', async () => {
    const { service } = createService();

    await expect(service.listCourses({ limit: 101 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires an existing course before listing groups', async () => {
    const { service, courseRepository, courseGroupRepository } = createService();
    courseRepository.findOne.mockResolvedValue(null);

    await expect(service.listGroups('missing-course')).rejects.toBeInstanceOf(NotFoundException);
    expect(courseGroupRepository.find).not.toHaveBeenCalled();
  });

  it('loads course details with groups and lists groups in label order', async () => {
    const { service, courseRepository, courseGroupRepository } = createService();
    const course = { id: 'course-1', groups: [] };
    courseRepository.findOne
      .mockResolvedValueOnce(course)
      .mockResolvedValueOnce({ id: 'course-1' });
    courseGroupRepository.find.mockResolvedValue([]);

    await expect(service.getCourse('course-1')).resolves.toBe(course);
    await service.listGroups('course-1');

    expect(courseRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { id: 'course-1' },
      relations: { groups: true },
    });
    expect(courseGroupRepository.find).toHaveBeenCalledWith({
      where: { courseId: 'course-1' },
      order: { groupLabel: 'ASC', id: 'ASC' },
    });
  });
});
