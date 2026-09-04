import { describe, expect, it, jest } from '@jest/globals';
import { EnrollmentService } from './enrollment.service';

function createService() {
  const enrollmentRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn((value) => Promise.resolve(value)),
  };
  const courseGroupRepository = { findOne: jest.fn() };
  const userRepository = { findOne: jest.fn() };
  const systemConfigRepository = { findOne: jest.fn() };
  return {
    service: new EnrollmentService(
      enrollmentRepository as any,
      courseGroupRepository as any,
      userRepository as any,
      systemConfigRepository as any,
    ),
    enrollmentRepository,
    courseGroupRepository,
    userRepository,
    systemConfigRepository,
  };
}

describe('EnrollmentService', () => {
  it('enrolls an active student in a current, non-archived group', async () => {
    const { service, enrollmentRepository, courseGroupRepository, userRepository, systemConfigRepository } = createService();
    const student = { id: 'student-1', role: 'student', accountStatus: 'active' };
    const group = { id: 'group-1', isArchived: false, course: { id: 'course-1', term: '2026-fall' } };
    userRepository.findOne.mockResolvedValue(student);
    courseGroupRepository.findOne.mockResolvedValue(group);
    systemConfigRepository.findOne.mockResolvedValue({ key: 'active_term', value: '2026-fall' });
    enrollmentRepository.findOne.mockResolvedValue(null);

    await service.enroll('student-1', 'group-1');

    expect(enrollmentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      studentId: 'student-1', courseGroupId: 'group-1', status: 'active', term: '2026-fall',
    }));
    expect(enrollmentRepository.save).toHaveBeenCalled();
  });

  it('does not trust a client-supplied term and rejects inactive terms', async () => {
    const { service, courseGroupRepository, userRepository, systemConfigRepository } = createService();
    userRepository.findOne.mockResolvedValue({ id: 'student-1', role: 'student', accountStatus: 'active' });
    courseGroupRepository.findOne.mockResolvedValue({ isArchived: false, course: { term: '2026-fall' } });
    systemConfigRepository.findOne.mockResolvedValue({ key: 'active_term', value: '2025-spring' });

    await expect(service.enroll('student-1', 'group-1')).rejects.toThrow('outside the active term');
  });

  it('soft-drops only the current student-owned active enrollment', async () => {
    const { service, enrollmentRepository } = createService();
    const enrollment = { id: 'enrollment-1', studentId: 'student-1', status: 'active' };
    enrollmentRepository.findOne.mockResolvedValue(enrollment);

    const result = await service.drop('student-1', 'enrollment-1');

    expect(result.status).toBe('dropped');
    expect(result.droppedAt).toBeInstanceOf(Date);
    expect(enrollmentRepository.save).toHaveBeenCalledWith(enrollment);
  });
});
