import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Question } from './question.entity';
import type { User } from '../../auth/entities/user.entity';

@Entity('question_votes')
export class QuestionVote {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'question_id' })
  questionId!: string;

  @ManyToOne('User', (user: User) => user.questionVotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne('Question', (question: Question) => question.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question!: Question;

  @Column({ type: 'varchar', length: 16 })
  value!: 'like' | 'dislike';

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
