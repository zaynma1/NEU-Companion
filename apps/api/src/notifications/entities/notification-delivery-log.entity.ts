import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Notification } from './notification.entity';

@Entity('notification_delivery_logs')
export class NotificationDeliveryLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne('Notification', (notification: Notification) => notification.deliveryLogs, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification!: Notification;

  @Column({ type: 'uuid', name: 'notification_id' })
  notificationId!: string;

  @Column({ type: 'text' })
  channel!: string;

  @Column({ type: 'text' })
  outcome!: string;

  @Column({ type: 'text', nullable: true, name: 'reason_code' })
  reasonCode?: string | null;

  @Column({ type: 'text', nullable: true, name: 'destination_snapshot' })
  destinationSnapshot?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
