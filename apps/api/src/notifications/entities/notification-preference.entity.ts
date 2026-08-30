import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, Unique } from 'typeorm';
import type { User } from '../../auth/entities/user.entity';

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  userId!: string;

  @ManyToOne('User', (user: User) => user.notificationPreferences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'boolean', default: true, name: 'reminders_enabled' })
  remindersEnabled!: boolean;

  @Column({ type: 'boolean', default: true, name: 'announcements_enabled' })
  announcementsEnabled!: boolean;
}
