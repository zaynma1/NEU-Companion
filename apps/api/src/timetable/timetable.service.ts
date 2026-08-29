import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { PersonalEvent } from './entities/personal-event.entity';
import { OfficialEvent } from './entities/official-event.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { CreatePersonalEventDto, UpdatePersonalEventDto, CheckConflictsDto } from './dtos/timetable.dto';

interface ConflictResult {
  severity: 'hard' | 'soft';
  eventId: string;
  sourceType: 'official';
  startDatetime: Date;
  endDatetime: Date;
  title: string;
  location?: string | null;
  courseGroupId: string;
}

@Injectable()
export class TimetableService {
  constructor(
    @InjectRepository(PersonalEvent)
    private readonly personalEventRepository: Repository<PersonalEvent>,
    @InjectRepository(OfficialEvent)
    private readonly officialEventRepository: Repository<OfficialEvent>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
  ) {}

  async getTimetable(
    userId: string,
    startDate: string,
    endDate: string,
    courseGroupId?: string,
  ): Promise<OfficialEvent[]> {
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      throw new BadRequestException('Invalid start or end date format');
    }

    // Get user's enrolled groups
    const enrollments = await this.enrollmentRepository.find({
      where: {
        studentId: userId,
        status: 'active',
        ...(courseGroupId && { courseGroupId }),
      },
      relations: ['courseGroup'],
    });

    const groupIds = enrollments.map((e) => e.courseGroupId);

    if (groupIds.length === 0) {
      return [];
    }

    // Fetch official events for those groups within the date range from current dataset
    const events = await this.officialEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.datasetVersion', 'version')
      .leftJoinAndSelect('event.courseGroup', 'group')
      .where('event.courseGroupId IN (:...groupIds)', { groupIds })
      .andWhere('version.isCurrent = :isCurrent', { isCurrent: true })
      .andWhere('event.startDatetime >= :startDateTime', { startDateTime })
      .andWhere('event.endDatetime <= :endDateTime', { endDateTime })
      .getMany();

    return events;
  }

  async getOfficialEventDetail(eventId: string, userId: string): Promise<OfficialEvent> {
    const event = await this.officialEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.datasetVersion', 'version')
      .leftJoinAndSelect('event.courseGroup', 'group')
      .where('event.id = :eventId', { eventId })
      .andWhere('version.isCurrent = :isCurrent', { isCurrent: true })
      .getOne();

    if (!event) {
      throw new NotFoundException('Official event not found');
    }

    // Check if user is enrolled in the course group or is a professor/admin
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        studentId: userId,
        courseGroupId: event.courseGroupId,
        status: 'active',
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You are not authorized to view this event');
    }

    return event;
  }

  async createPersonalEvent(userId: string, dto: CreatePersonalEventDto): Promise<PersonalEvent> {
    const startDateTime = new Date(dto.startDatetime);
    const endDateTime = new Date(dto.endDatetime);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      throw new BadRequestException('Invalid start or end datetime format');
    }

    if (endDateTime <= startDateTime) {
      throw new BadRequestException('End datetime must be after start datetime');
    }

    if (dto.isRecurring && dto.recurrenceRule) {
      if (!dto.recurrenceEndDate) {
        throw new BadRequestException('Recurring events must have a recurrence_end_date');
      }
      const recurrenceEndDate = new Date(dto.recurrenceEndDate);
      if (isNaN(recurrenceEndDate.getTime())) {
        throw new BadRequestException('Invalid recurrence_end_date format');
      }
      if (recurrenceEndDate <= startDateTime) {
        throw new BadRequestException('Recurrence end date must be after the event start date');
      }
      // Validate recurrence horizon (e.g., max 2 years in the future)
      const maxHorizon = new Date(startDateTime.getTime() + 730 * 24 * 60 * 60 * 1000);
      if (recurrenceEndDate > maxHorizon) {
        throw new BadRequestException('Recurrence horizon exceeded; max 2 years in the future');
      }
    }

    const personalEvent = this.personalEventRepository.create({
      userId,
      title: dto.title,
      description: dto.description,
      startDatetime: startDateTime,
      endDatetime: endDateTime,
      location: dto.location,
      eventType: dto.eventType,
      isRecurring: dto.isRecurring || false,
      recurrenceRule: dto.recurrenceRule,
      recurrenceEndDate: dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : undefined,
    });

    return this.personalEventRepository.save(personalEvent);
  }

  async getPersonalEvents(userId: string, startDate: string, endDate: string): Promise<PersonalEvent[]> {
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      throw new BadRequestException('Invalid start or end date format');
    }

    return this.personalEventRepository.find({
      where: {
        userId,
        startDatetime: MoreThanOrEqual(startDateTime),
        endDatetime: LessThanOrEqual(endDateTime),
      },
      order: { startDatetime: 'ASC' },
    });
  }

  async updatePersonalEvent(
    eventId: string,
    userId: string,
    dto: UpdatePersonalEventDto,
  ): Promise<PersonalEvent> {
    const event = await this.personalEventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Personal event not found');
    }

    if (event.userId !== userId) {
      throw new ForbiddenException('You are not authorized to update this event');
    }

    if (dto.startDatetime) {
      event.startDatetime = new Date(dto.startDatetime);
    }
    if (dto.endDatetime) {
      event.endDatetime = new Date(dto.endDatetime);
    }

    if (event.endDatetime <= event.startDatetime) {
      throw new BadRequestException('End datetime must be after start datetime');
    }

    if (dto.title) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.location !== undefined) event.location = dto.location;
    if (dto.eventType !== undefined) event.eventType = dto.eventType;
    if (dto.isRecurring !== undefined) event.isRecurring = dto.isRecurring;
    if (dto.recurrenceRule !== undefined) event.recurrenceRule = dto.recurrenceRule;
    if (dto.recurrenceEndDate) {
      event.recurrenceEndDate = new Date(dto.recurrenceEndDate);
    }

    return this.personalEventRepository.save(event);
  }

  async deletePersonalEvent(eventId: string, userId: string): Promise<void> {
    const event = await this.personalEventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Personal event not found');
    }

    if (event.userId !== userId) {
      throw new ForbiddenException('You are not authorized to delete this event');
    }

    await this.personalEventRepository.remove(event);
  }

  async checkConflicts(userId: string, dto: CheckConflictsDto): Promise<ConflictResult[]> {
    const startDateTime = new Date(dto.startDatetime);
    const endDateTime = new Date(dto.endDatetime);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      throw new BadRequestException('Invalid start or end datetime format');
    }

    if (endDateTime <= startDateTime) {
      throw new BadRequestException('End datetime must be after start datetime');
    }

    // Get user's enrolled groups
    const enrollments = await this.enrollmentRepository.find({
      where: {
        studentId: userId,
        status: 'active',
      },
      relations: ['courseGroup'],
    });

    const groupIds = enrollments.map((e) => e.courseGroupId);

    if (groupIds.length === 0) {
      return [];
    }

    // Find official events that overlap with the proposed personal event from current dataset
    const overlappingEvents = await this.officialEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.datasetVersion', 'version')
      .where('event.courseGroupId IN (:...groupIds)', { groupIds })
      .andWhere('version.isCurrent = :isCurrent', { isCurrent: true })
      .andWhere(
        '(event.startDatetime < :endDateTime AND event.endDatetime > :startDateTime)',
        { startDateTime, endDateTime },
      )
      .getMany();

    const conflicts: ConflictResult[] = overlappingEvents.map((event) => ({
      severity: 'hard', // Could be soft or hard based on overlap percentage
      eventId: event.id,
      sourceType: 'official' as const,
      startDatetime: event.startDatetime,
      endDatetime: event.endDatetime,
      title: `${event.eventType} event`,
      location: event.location,
      courseGroupId: event.courseGroupId,
    }));

    return conflicts;
  }

  async getOfficialEventsForCourseGroup(groupId: string, userId: string, startDate: string, endDate: string): Promise<OfficialEvent[]> {
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      throw new BadRequestException('Invalid start or end date format');
    }

    // Check if user has access to this group
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        studentId: userId,
        courseGroupId: groupId,
        status: 'active',
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You are not authorized to access this group');
    }

    return this.officialEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.datasetVersion', 'version')
      .where('event.courseGroupId = :groupId', { groupId })
      .andWhere('version.isCurrent = :isCurrent', { isCurrent: true })
      .andWhere('event.startDatetime >= :startDateTime', { startDateTime })
      .andWhere('event.endDatetime <= :endDateTime', { endDateTime })
      .orderBy('event.startDatetime', 'ASC')
      .getMany();
  }
}
