import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { NotificationService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  UpdateNotificationPreferenceDto,
  MuteCourseDto,
  PublishAnnouncementDto,
  GetNotificationFeedQueryDto,
  GetCourseGroupAnnouncementsQueryDto,
  MarkAllAsReadDto,
  ListAdminNotificationsQueryDto,
} from './dtos/notification.dto';

@Controller('api/v1')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('notifications/preferences')
  async getPreferences(@Request() req: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const prefs = await this.notificationService.getPreferences(user.id);

    return {
      status: 'success',
      data: prefs,
    };
  }

  @Put('notifications/preferences')
  async updatePreferences(
    @Body() dto: UpdateNotificationPreferenceDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const prefs = await this.notificationService.updatePreferences(user.id, dto);

    return {
      status: 'success',
      data: prefs,
    };
  }

  @Get('notifications/muted-courses')
  async getMutedCourses(@Request() req: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const muted = await this.notificationService.getMutedCourses(user.id);

    return {
      status: 'success',
      data: muted,
    };
  }

  @Post('notifications/muted-courses')
  async muteCourse(
    @Body() dto: MuteCourseDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const muted = await this.notificationService.muteCourse(user.id, dto);

    return {
      status: 'success',
      data: muted,
    };
  }

  @Delete('notifications/muted-courses/:courseId')
  async unmuteCourse(
    @Param('courseId') courseId: string,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    await this.notificationService.unmuteCourse(user.id, courseId);

    return {
      status: 'success',
      message: 'Course unmuted',
    };
  }

  @Get('notifications')
  async getNotificationFeed(
    @Query() query: GetNotificationFeedQueryDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const limit = Math.min(parseInt(query.limit) || 50, 200);

    const result = await this.notificationService.getNotificationFeed(
      user.id,
      query.unreadOnly || false,
      query.type,
      limit,
      query.cursor,
    );

    return {
      status: 'success',
      data: result.notifications,
      unreadCount: result.unreadCount,
      nextCursor: result.nextCursor,
    };
  }

  @Post('notifications/:notificationId/read')
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const notification = await this.notificationService.markAsRead(notificationId, user.id);

    return {
      status: 'success',
      data: notification,
    };
  }

  @Post('notifications/read-all')
  async markAllAsRead(
    @Body() dto: MarkAllAsReadDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const limit = Math.min(parseInt(dto.limit || '500'), 500);
    const result = await this.notificationService.markAllAsRead(user.id, limit);

    return {
      status: 'success',
      data: result,
    };
  }

  @Post('announcements')
  async publishAnnouncement(
    @Body() dto: PublishAnnouncementDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const announcement = await this.notificationService.publishAnnouncement(user.id, dto);

    return {
      status: 'success',
      data: announcement,
    };
  }

  @Get('announcements/:announcementId')
  async getAnnouncementDetail(
    @Param('announcementId') announcementId: string,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const announcement = await this.notificationService.getAnnouncementDetail(announcementId, user.id);

    return {
      status: 'success',
      data: announcement,
    };
  }

  @Get('course-groups/:groupId/announcements')
  async listCourseGroupAnnouncements(
    @Param('groupId') groupId: string,
    @Query() query: GetCourseGroupAnnouncementsQueryDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const limit = Math.min(parseInt(query.limit) || 50, 100);

    const result = await this.notificationService.listCourseGroupAnnouncements(
      groupId,
      user.id,
      query.includeExpired || false,
      limit,
      query.cursor,
    );

    return {
      status: 'success',
      data: result.announcements,
      nextCursor: result.nextCursor,
    };
  }
}

@Controller('api/v1/admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('notifications/:notificationId/delivery-status')
  async getDeliveryStatus(
    @Param('notificationId') notificationId: string,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    // Stub: return empty for now
    return {
      status: 'success',
      data: {
        notificationId,
        channel: 'in_app',
        status: 'delivered',
        deliveredAt: new Date(),
      },
    };
  }

  @Get('notifications')
  async listFailedNotifications(
    @Query() query: ListAdminNotificationsQueryDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const limit = Math.min(parseInt(query.limit) || 50, 100);

    // Stub: return empty list for now
    return {
      status: 'success',
      data: [],
      nextCursor: undefined,
    };
  }

  @Post('notifications/:notificationId/retry')
  async retryNotification(
    @Param('notificationId') notificationId: string,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    // Stub: acknowledge retry request
    return {
      status: 'success',
      message: 'Retry request accepted',
      data: {
        notificationId,
        status: 'queued',
      },
    };
  }
}
