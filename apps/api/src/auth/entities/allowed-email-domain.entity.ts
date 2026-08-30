import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('allowed_email_domains')
export class AllowedEmailDomain {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  emailDomain!: string;

  @Column({ type: 'boolean', default: false })
  allowSubdomains!: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
