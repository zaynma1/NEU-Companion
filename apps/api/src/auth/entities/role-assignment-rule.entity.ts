import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('role_assignment_rules')
export class RoleAssignmentRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  domainPattern!: string;

  @Column({ type: 'varchar', length: 32 })
  inferredRole!: 'student' | 'professor' | 'admin';

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
