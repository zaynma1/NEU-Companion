import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('visibility_settings')
export class VisibilitySetting {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @PrimaryColumn({ type: 'varchar', length: 32, name: 'field_name' })
  fieldName!: 'real_name' | 'username' | 'email' | 'contact_method';

  @ManyToOne('User', (user: User) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 32, name: 'visibility_level' })
  visibilityLevel!: 'public' | 'course_members_only' | 'private';
}
