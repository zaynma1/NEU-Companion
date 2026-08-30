import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('profiles')
export class Profile {
  @PrimaryColumn('uuid')
  userId!: string;

  @OneToOne('User', (user: User) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'photo_url' })
  photoUrl?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'unverified', name: 'verification_status' })
  verificationStatus!: 'unverified' | 'verified';

  @Column({ type: 'timestamptz', nullable: true, name: 'created_at' })
  createdAt?: Date | null;
}
