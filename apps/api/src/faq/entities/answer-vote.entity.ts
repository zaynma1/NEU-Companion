import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Answer } from './answer.entity';
import type { User } from '../../auth/entities/user.entity';

@Entity('answer_votes')
export class AnswerVote {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'answer_id' })
  answerId!: string;

  @ManyToOne('User', (user: User) => user.answerVotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne('Answer', (answer: Answer) => answer.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'answer_id' })
  answer!: Answer;

  @Column({ type: 'varchar', length: 16 })
  value!: 'like' | 'dislike';

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
