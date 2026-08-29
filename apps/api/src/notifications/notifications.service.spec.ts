import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationService } from './notifications.service';
import { NotificationPreference } from './entities/notification-preference.entity';
import { MutedCourse } from './entities/muted-course.entity';
import { Notification } from './entities/notification.entity';
import { Announcement } from './entities/announcement.entity';
import { User } from '../auth/entities/user.entity';
import { Course } from '../courses/entities/course.entity';
import { CourseGroup } from '../courses/entities/course-group.entity';
import { ProfessorTeachingClaim } from '../courses/entities/professor-teaching-claim.entity';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockPreferenceRepository: any;
  let mockMutedCourseRepository: any;
  let mockNotificationRepository: any;
  let mockAnnouncementRepository: any;
  let mockUserRepository: any;
  let mockCourseGroupRepository: any;
  let mockCourseRepository: any;
  let mockTeachingClaimRepository: any;

  beforeEach(async () => {
    mockPreferenceRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockMutedCourseRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockNotificationRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      })),
    };

    mockAnnouncementRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      })),
    };

    mockUserRepository = {};
    mockCourseGroupRepository = {
      findOne: jest.fn(),
    };
    mockCourseRepository = {};
    mockTeachingClaimRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: mockPreferenceRepository,
        },
        {
          provide: getRepositoryToken(MutedCourse),
          useValue: mockMutedCourseRepository,
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
        {
          provide: getRepositoryToken(Announcement),
          useValue: mockAnnouncementRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(CourseGroup),
          useValue: mockCourseGroupRepository,
        },
        {
          provide: getRepositoryToken(Course),
          useValue: mockCourseRepository,
        },
        {
          provide: getRepositoryToken(ProfessorTeachingClaim),
          useValue: mockTeachingClaimRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPreferences', () => {
    it('should return existing preferences', async () => {
      const userId = '123';
      const prefs = { userId, remindersEnabled: true, announcementsEnabled: true };
      mockPreferenceRepository.findOne.mockResolvedValue(prefs);

      const result = await service.getPreferences(userId);

      expect(result).toEqual(prefs);
      expect(mockPreferenceRepository.findOne).toHaveBeenCalledWith({ where: { userId } });
    });

    it('should create default preferences if not found', async () => {
      const userId = '123';
      mockPreferenceRepository.findOne.mockResolvedValue(null);
      const newPrefs = { userId, remindersEnabled: true, announcementsEnabled: true };
      mockPreferenceRepository.create.mockReturnValue(newPrefs);
      mockPreferenceRepository.save.mockResolvedValue(newPrefs);

      const result = await service.getPreferences(userId);

      expect(result).toEqual(newPrefs);
      expect(mockPreferenceRepository.create).toHaveBeenCalled();
      expect(mockPreferenceRepository.save).toHaveBeenCalled();
    });
  });

  describe('idempotencyKey generation', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = service.generateIdempotencyKey('user1', 'event1', 'reminder', 'in_app');
      const key2 = service.generateIdempotencyKey('user1', 'event1', 'reminder', 'in_app');

      expect(key1).toEqual(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = service.generateIdempotencyKey('user1', 'event1', 'reminder', 'in_app');
      const key2 = service.generateIdempotencyKey('user2', 'event1', 'reminder', 'in_app');

      expect(key1).not.toEqual(key2);
    });
  });
});
