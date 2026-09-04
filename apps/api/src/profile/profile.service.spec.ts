import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProfileService } from './profile.service';
import { Profile } from './entities/profile.entity';
import { ContactMethod } from './entities/contact-method.entity';
import { VisibilitySetting } from './entities/visibility-setting.entity';
import { ProfessorScheduleDocument } from './entities/professor-schedule-document.entity';
import { User } from '../auth/entities/user.entity';

describe('ProfileService', () => {
  let service: ProfileService;
  let profileRepo: any;
  let contactRepo: any;
  let visibilityRepo: any;
  let documentRepo: any;
  let userRepo: any;

  beforeEach(async () => {
    profileRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    contactRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    visibilityRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    documentRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    userRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: getRepositoryToken(Profile), useValue: profileRepo },
        { provide: getRepositoryToken(ContactMethod), useValue: contactRepo },
        { provide: getRepositoryToken(VisibilitySetting), useValue: visibilityRepo },
        { provide: getRepositoryToken(ProfessorScheduleDocument), useValue: documentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should return current profile for a user', async () => {
    const mockProfile = {
      userId: 'user-1',
      photoUrl: 'https://example.com/avatar.png',
      verificationStatus: 'verified',
      username: 'alice',
    };

    profileRepo.findOne.mockResolvedValue(mockProfile);

    const result = await service.getCurrentProfile('user-1');

    expect(result).toEqual(expect.objectContaining({ userId: 'user-1', verificationStatus: 'verified' }));
    expect(profileRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  describe('audit 8.1 - office-hours writes require ownership or admin role', () => {
    const professor = { id: 'professor-1', role: 'professor' };
    const document = { id: 'document-1', professorId: 'professor-1' };
    const dto = { fileUrl: 'https://example.com/office-hours.pdf', mimeType: 'application/pdf' };

    beforeEach(() => {
      userRepo.findOne.mockResolvedValue(professor);
      documentRepo.findOne.mockResolvedValue(document);
      documentRepo.save.mockResolvedValue(document);
      documentRepo.remove.mockResolvedValue(document);
    });

    it('rejects a student targeting another professor before resolving the target or mutating storage', async () => {
      await expect(service.upsertProfessorOfficeHours('professor-1', 'student-1', 'student', dto))
        .rejects.toThrow('Not authorized to modify office-hours document');
      await expect(service.deleteProfessorOfficeHours('professor-1', 'student-1', 'student'))
        .rejects.toThrow('Not authorized to modify office-hours document');

      expect(userRepo.findOne).not.toHaveBeenCalled();
      expect(documentRepo.create).not.toHaveBeenCalled();
      expect(documentRepo.save).not.toHaveBeenCalled();
      expect(documentRepo.remove).not.toHaveBeenCalled();
    });

    it('rejects a student targeting a non-existent professor ID with the same authorization error', async () => {
      await expect(service.upsertProfessorOfficeHours('missing-professor', 'student-1', 'student', dto))
        .rejects.toThrow('Not authorized to modify office-hours document');
      await expect(service.deleteProfessorOfficeHours('missing-professor', 'student-1', 'student'))
        .rejects.toThrow('Not authorized to modify office-hours document');

      expect(userRepo.findOne).not.toHaveBeenCalled();
      expect(documentRepo.create).not.toHaveBeenCalled();
      expect(documentRepo.save).not.toHaveBeenCalled();
      expect(documentRepo.remove).not.toHaveBeenCalled();
    });

    it('rejects an owner whose target user is not a professor', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'student-1', role: 'student' });

      await expect(service.upsertProfessorOfficeHours('student-1', 'student-1', 'student', dto))
        .rejects.toThrow('Office-hours documents are restricted to professors');
      await expect(service.deleteProfessorOfficeHours('student-1', 'student-1', 'student'))
        .rejects.toThrow('Office-hours documents are restricted to professors');

      expect(documentRepo.create).not.toHaveBeenCalled();
      expect(documentRepo.save).not.toHaveBeenCalled();
      expect(documentRepo.remove).not.toHaveBeenCalled();
    });

    it('allows a professor to upsert and delete their own document', async () => {
      await service.upsertProfessorOfficeHours('professor-1', 'professor-1', 'professor', dto);
      await service.deleteProfessorOfficeHours('professor-1', 'professor-1', 'professor');

      expect(documentRepo.save).toHaveBeenCalled();
      expect(documentRepo.remove).toHaveBeenCalledWith(document);
    });

    it('allows an admin to upsert and delete any professor document', async () => {
      await service.upsertProfessorOfficeHours('professor-1', 'admin-1', 'admin', dto);
      await service.deleteProfessorOfficeHours('professor-1', 'admin-1', 'admin');

      expect(documentRepo.save).toHaveBeenCalled();
      expect(documentRepo.remove).toHaveBeenCalledWith(document);
    });
  });
});
