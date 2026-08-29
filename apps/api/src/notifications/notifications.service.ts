import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { NotificationPreference } from './entities/notification-preference.entity';
import { MutedCourse } from './entities/muted-course.entity';
import { Notification } from './entities/notification.entity';
import { Announcement } from './entities/announcement.entity';
import { UpdateNotificationPreferenceDto, MuteCourseDto, PublishAnnouncementDto } from './dtos/notification.dto';
import { User } from '../auth/entities/user.entity';
import { Course } from '../courses/entities/course.entity';
import { CourseGroup } from '../courses/entities/course-group.entity';
import { ProfessorTeachingClaim } from '../courses/entities/professor-teaching-claim.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(MutedCourse)
    private readonly mutedCourseRepository: Repository<MutedCourse>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CourseGroup)
    private readonly courseGroupRepository: Repository<CourseGroup>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(ProfessorTeachingClaim)
    private readonly teachingClaimRepository: Repository<ProfessorTeachingClaim>,
  ) {}

  /**
   * Get notification preferences for a user
   */
  async getPreferences(userId: string): Promise<NotificationPreference> {
    let pref = await this.preferenceRepository.findOne({ where: { userId } });

    if (!pref) {
      // Create default preferences
      pref = this.preferenceRepository.create({
        userId,
        remindersEnabled: true,
        announcementsEnabled: true,
      });
      pref = await this.preferenceRepository.save(pref);
    }

    return pref;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(userId: string, dto: UpdateNotificationPreferenceDto): Promise<NotificationPreference> {
    let pref = await this.preferenceRepository.findOne({ where: { userId } });

    if (!pref) {
      pref = this.preferenceRepository.create({ userId });
    }

    if (dto.remindersEnabled !== undefined) {
      pref.remindersEnabled = dto.remindersEnabled;
    }
    if (dto.announcementsEnabled !== undefined) {
      pref.announcementsEnabled = dto.announcementsEnabled;
    }

    return this.preferenceRepository.save(pref);
  }

  /**
   * Get muted courses for a user
   */
  async getMutedCourses(userId: string): Promise<MutedCourse[]> {
    return this.mutedCourseRepository.find({
      where: { userId },
      relations: ['course'],
    });
  }

  /**
   * Mute a course for a user
   */
  async muteCourse(userId: string, dto: MuteCourseDto): Promise<MutedCourse> {
    const existing = await this.mutedCourseRepository.findOne({
      where: { userId, courseId: dto.courseId },
    });

    if (existing) {
      return existing;
    }

    const muted = this.mutedCourseRepository.create({
      userId,
      courseId: dto.courseId,
    });

    return this.mutedCourseRepository.save(muted);
  }

  /**
   * Unmute a course for a user
   */
  async unmuteCourse(userId: string, courseId: string): Promise<void> {
    await this.mutedCourseRepository.delete({
      userId,
      courseId,
    });
  }

  /**
   * Get notification feed for a user
   */
  async getNotificationFeed(
    userId: string,
    unreadOnly: boolean = false,
    type?: 'reminder' | 'announcement',
    limit: number = 50,
    cursor?: string,
  ): Promise<{ notifications: Notification[]; unreadCount: number; nextCursor?: string }> {
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.recipientId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC');

    if (unreadOnly) {
      queryBuilder.andWhere('n.readAt IS NULL');
    }

    if (type) {
      queryBuilder.andWhere('n.notificationType = :type', { type });
    }

    if (cursor) {
      queryBuilder.andWhere('n.createdAt < :cursor', { cursor });
    }

    const notifications = await queryBuilder.take(limit + 1).getMany();
    const hasMore = notifications.length > limit;

    // Count unread
    const unreadCount = await this.notificationRepository.count({
      where: { recipientId: userId, readAt: IsNull() },
    });

    return {
      notifications: notifications.slice(0, limit),
      unreadCount,
      nextCursor: hasMore ? notifications[limit - 1].createdAt.toISOString() : undefined,
    };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    if (notification.recipientId !== userId) {
      throw new ForbiddenException('You are not authorized to update this notification');
    }

    notification.readAt = new Date();
    return this.notificationRepository.save(notification);
  }

  /**
   * Mark all notifications as read for a user (bounded to limit)
   */
  async markAllAsRead(userId: string, limit: number = 500): Promise<{ markedCount: number; hasMore: boolean }> {
    const unreadNotifications = await this.notificationRepository.find({
      where: { recipientId: userId, readAt: IsNull() },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: limit + 1,
    });

    const toMark = unreadNotifications.slice(0, limit);
    const hasMore = unreadNotifications.length > limit;

    for (const notification of toMark) {
      notification.readAt = new Date();
    }

    await this.notificationRepository.save(toMark);

    return {
      markedCount: toMark.length,
      hasMore,
    };
  }

  /**
   * Publish an announcement
   */
  async publishAnnouncement(userId: string, dto: PublishAnnouncementDto): Promise<Announcement> {
    // Verify professor has teaching claim for this group
    const teachingClaim = await this.teachingClaimRepository.findOne({
      where: {
        professorId: userId,
        courseGroupId: dto.courseGroupId,
        verifiedAt: MoreThan(new Date()),
      },
    });

    if (!teachingClaim) {
      throw new ForbiddenException('You do not have an active teaching claim for this course group');
    }

    // Verify course group exists and belongs to the specified course
    const courseGroup = await this.courseGroupRepository.findOne({
      where: { id: dto.courseGroupId },
      relations: ['course'],
    });

    if (!courseGroup || courseGroup.courseId !== dto.courseId) {
      throw new BadRequestException('Invalid course group for this course');
    }

    if (!dto.body || dto.body.trim().length === 0) {
      throw new BadRequestException('Announcement body cannot be empty');
    }

    const announcement = this.announcementRepository.create({
      courseId: dto.courseId,
      courseGroupId: dto.courseGroupId,
      professorId: userId,
      body: dto.body,
      expiryAt: dto.expiryAt ? new Date(dto.expiryAt) : undefined,
    });

    return this.announcementRepository.save(announcement);
  }

  /**
   * Get announcement detail
   */
  async getAnnouncementDetail(announcementId: string, userId: string): Promise<Announcement> {
    const announcement = await this.announcementRepository.findOne({
      where: { id: announcementId },
      relations: ['course', 'courseGroup', 'professor'],
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement ${announcementId} not found`);
    }

    // Check if user is eligible (enrolled in group or is professor/admin)
    // Stub: allow all for now
    return announcement;
  }

  /**
   * List announcements for a course group
   */
  async listCourseGroupAnnouncements(
    groupId: string,
    userId: string,
    includeExpired: boolean = false,
    limit: number = 50,
    cursor?: string,
  ): Promise<{ announcements: Announcement[]; nextCursor?: string }> {
    const queryBuilder = this.announcementRepository
      .createQueryBuilder('a')
      .where('a.courseGroupId = :groupId', { groupId })
      .orderBy('a.publishedAt', 'DESC');

    if (!includeExpired) {
      queryBuilder.andWhere('(a.expiryAt IS NULL OR a.expiryAt > NOW())');
    }

    if (cursor) {
      queryBuilder.andWhere('a.publishedAt < :cursor', { cursor });
    }

    const announcements = await queryBuilder.take(limit + 1).getMany();
    const hasMore = announcements.length > limit;

    return {
      announcements: announcements.slice(0, limit),
      nextCursor: hasMore ? announcements[limit - 1].publishedAt.toISOString() : undefined,
    };
  }

  /**
   * Generate idempotency key for notification
   */
  generateIdempotencyKey(
    recipientId: string,
    eventId: string | null,
    reminderWindow: string | null,
    channel: string,
  ): string {
    const components = [recipientId, eventId || 'none', reminderWindow || 'none', channel];
    return crypto.createHash('sha256').update(components.join('|')).digest('hex');
  }
}
