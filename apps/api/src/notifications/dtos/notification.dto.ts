import { IsOptional, IsBoolean, IsString, IsUUID, IsISO8601 } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  announcementsEnabled?: boolean;
}

export class MuteCourseDto {
  @IsUUID()
  courseId!: string;
}

export class PublishAnnouncementDto {
  @IsUUID()
  courseId!: string;

  @IsUUID()
  courseGroupId!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsISO8601()
  expiryAt?: string;
}

export class GetNotificationFeedQueryDto {
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsString()
  type?: 'reminder' | 'announcement';

  @IsString()
  limit!: string; // 1..200

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class GetCourseGroupAnnouncementsQueryDto {
  @IsOptional()
  @IsBoolean()
  includeExpired?: boolean;

  @IsString()
  limit!: string; // 1..100

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class MarkAllAsReadDto {
  @IsOptional()
  @IsString()
  limit?: string; // 1..500, defaults to 500
}

export class ListAdminNotificationsQueryDto {
  @IsString()
  status!: 'failed' | 'suppressed';

  @IsOptional()
  @IsString()
  notificationType?: 'reminder' | 'announcement';

  @IsOptional()
  @IsString()
  channel?: 'in_app' | 'email';

  @IsOptional()
  @IsUUID()
  recipientId?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsString()
  limit!: string; // 1..100

  @IsOptional()
  @IsString()
  cursor?: string;
}
