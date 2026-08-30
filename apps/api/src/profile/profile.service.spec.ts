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
});
