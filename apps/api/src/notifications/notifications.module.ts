import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';
import { MutedCourse } from './entities/muted-course.entity';
import { Announcement } from './entities/announcement.entity';
import { Notification } from './entities/notification.entity';
import { NotificationDeliveryLog } from './entities/notification-delivery-log.entity';
import { NotificationService } from './notifications.service';
import { NotificationController, AdminNotificationController } from './notifications.controller';
import { AuthModule } from '../auth/auth.module';
import { CourseGroup } from '../courses/entities/course-group.entity';
import { Course } from '../courses/entities/course.entity';
import { ProfessorTeachingClaim } from '../courses/entities/professor-teaching-claim.entity';
import { RolesGuard } from '../auth/roles.guard';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      NotificationPreference,
      MutedCourse,
      Announcement,
      Notification,
      NotificationDeliveryLog,
      User,
      CourseGroup,
      Course,
      ProfessorTeachingClaim,
    ]),
  ],
  providers: [NotificationService, RolesGuard],
  controllers: [NotificationController, AdminNotificationController],
  exports: [NotificationService],
})
export class NotificationsModule {}
