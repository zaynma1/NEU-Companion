import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from '../../auth/entities/user.entity';
import type { Question } from './question.entity';
import type { AnswerVote } from './answer-vote.entity';

@Entity('answers')
export class Answer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'question_id' })
  questionId!: string;

  @ManyToOne('Question', (question: Question) => question.answers, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question!: Question;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @ManyToOne('User', (user: User) => user.answers, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'boolean', default: false, name: 'is_accepted' })
  isAccepted!: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'hidden_at' })
  hiddenAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany('AnswerVote', (vote: AnswerVote) => vote.answer)
  votes!: AnswerVote[];
}
