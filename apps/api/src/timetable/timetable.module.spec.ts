import { Test, TestingModule } from '@nestjs/testing';
import { TimetableService } from './timetable.service';
import { TimetableController } from './timetable.controller';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PersonalEvent } from './entities/personal-event.entity';
import { OfficialEvent } from './entities/official-event.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/entities/user.entity';
import { Session } from '../auth/entities/session.entity';

describe('TimetableModule', () => {
  let service: TimetableService;
  let controller: TimetableController;

  beforeEach(async () => {
    const mockRepository = {
      find: () => Promise.resolve([]),
      findOne: () => Promise.resolve(null),
      create: (dto: any) => dto,
      save: (entity: any) => Promise.resolve(entity),
      remove: () => Promise.resolve(),
    };

    const mockQueryBuilder = {
      where: function () {
        return this;
      },
      andWhere: function () {
        return this;
      },
      getMany: () => Promise.resolve([]),
    };

    const mockOfficialEventRepository = {
      find: () => Promise.resolve([]),
      findOne: () => Promise.resolve(null),
      createQueryBuilder: () => mockQueryBuilder,
    };

    const mockAuthService = {
      validateSessionToken: () => Promise.resolve({ id: 'session-id', user: { id: 'user-id', role: 'student' } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableService,
        AuthGuard,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: getRepositoryToken(PersonalEvent),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(OfficialEvent),
          useValue: mockOfficialEventRepository,
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: mockRepository,
        },
      ],
      controllers: [TimetableController],
    }).compile();

    service = module.get<TimetableService>(TimetableService);
    controller = module.get<TimetableController>(TimetableController);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(controller).toBeDefined();
  });

  describe('TimetableService.createPersonalEvent', () => {
    it('should reject events where end time is before start time', async () => {
      const dto = {
        title: 'Test Event',
        startDatetime: '2026-12-01T10:00:00Z',
        endDatetime: '2026-12-01T09:00:00Z',
      };

      await expect(service.createPersonalEvent('user-id', dto)).rejects.toThrow('End datetime must be after start datetime');
    });

    it('should reject recurring events without recurrence_end_date', async () => {
      const dto = {
        title: 'Recurring Event',
        startDatetime: '2026-12-01T10:00:00Z',
        endDatetime: '2026-12-01T11:00:00Z',
        isRecurring: true,
        recurrenceRule: 'FREQ=WEEKLY',
      };

      await expect(service.createPersonalEvent('user-id', dto)).rejects.toThrow('Recurring events must have a recurrence_end_date');
    });

    it('should reject events that exceed the recurrence horizon', async () => {
      const now = new Date();
      const farFuture = new Date(now.getTime() + 800 * 24 * 60 * 60 * 1000); // 800 days

      const dto = {
        title: 'Far Event',
        startDatetime: now.toISOString(),
        endDatetime: new Date(now.getTime() + 3600 * 1000).toISOString(),
        isRecurring: true,
        recurrenceRule: 'FREQ=WEEKLY',
        recurrenceEndDate: farFuture.toISOString(),
      };

      await expect(service.createPersonalEvent('user-id', dto)).rejects.toThrow('Recurrence horizon exceeded');
    });
  });

  describe('TimetableService.getTimetable', () => {
    it('should reject invalid date formats', async () => {
      await expect(
        service.getTimetable('user-id', 'invalid-date', '2026-12-31'),
      ).rejects.toThrow('Invalid start or end date format');
    });
  });
});
