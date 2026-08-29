import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { User } from '../../auth/entities/user.entity';
import type { OfficialEvent } from '../../timetable/entities/official-event.entity';
import type { PersonalEvent } from '../../timetable/entities/personal-event.entity';
import type { Announcement } from './announcement.entity';
import type { NotificationDeliveryLog } from './notification-delivery-log.entity';

@Entity('notifications')
@Unique(['idempotencyKey'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne('User', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient!: User;

  @Column({ type: 'uuid', name: 'recipient_id' })
  recipientId!: string;

  @Column({
    type: 'varchar',
    length: 32,
    enum: ['reminder', 'announcement'],
    name: 'notification_type',
  })
  notificationType!: 'reminder' | 'announcement';

  @ManyToOne('OfficialEvent', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'official_event_id' })
  officialEvent?: OfficialEvent | null;

  @Column({ type: 'uuid', nullable: true, name: 'official_event_id' })
  officialEventId?: string | null;

  @ManyToOne('PersonalEvent', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'personal_event_id' })
  personalEvent?: PersonalEvent | null;

  @Column({ type: 'uuid', nullable: true, name: 'personal_event_id' })
  personalEventId?: string | null;

  @ManyToOne('Announcement', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'announcement_id' })
  announcement?: Announcement | null;

  @Column({ type: 'uuid', nullable: true, name: 'announcement_id' })
  announcementId?: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
    enum: ['1_day', '3_hour', '1_hour', 'at_due'],
    name: 'reminder_window',
  })
  reminderWindow?: '1_day' | '3_hour' | '1_hour' | 'at_due' | null;

  @Column({
    type: 'varchar',
    length: 32,
    enum: ['in_app', 'email'],
  })
  channel!: 'in_app' | 'email';

  @Column({
    type: 'varchar',
    length: 32,
    default: 'queued',
    enum: ['queued', 'delivered', 'failed', 'suppressed'],
  })
  status!: 'queued' | 'delivered' | 'failed' | 'suppressed';

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'reason_code' })
  reasonCode?: string | null;

  @Column({ type: 'text', name: 'idempotency_key' })
  idempotencyKey!: string;

  @ManyToOne('Notification', { nullable: true })
  @JoinColumn({ name: 'triggered_by_notification_id' })
  triggeredBy?: Notification | null;

  @Column({ type: 'uuid', nullable: true, name: 'triggered_by_notification_id' })
  triggeredById?: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'read_at' })
  readAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'delivered_at' })
  deliveredAt?: Date | null;

  @OneToMany('NotificationDeliveryLog', (log: NotificationDeliveryLog) => log.notification)
  deliveryLogs!: NotificationDeliveryLog[];
}
