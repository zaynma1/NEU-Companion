import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from '../../auth/entities/user.entity';
import type { Answer } from './answer.entity';
import type { QuestionTag } from './question-tag.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @ManyToOne('User', (user: User) => user.questions, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'varchar', length: 32, default: 'open' })
  status!: 'open' | 'answered' | 'resolved';

  @Column({ type: 'boolean', default: false, name: 'is_locked' })
  isLocked!: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'hidden_at' })
  hiddenAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'edit_window_expires_at' })
  editWindowExpiresAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  resolutionNote?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToMany('CategoryTag', { cascade: true })
  @JoinTable({
    name: 'question_tags',
    joinColumn: { name: 'question_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_tag_id', referencedColumnName: 'id' },
  })
  tags!: CategoryTag[];

  @OneToMany('Answer', (answer: Answer) => answer.question)
  answers!: Answer[];
}
