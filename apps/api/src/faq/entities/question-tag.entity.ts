import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { CategoryTag } from './category-tag.entity';
import type { Question } from './question.entity';

@Entity('question_tags')
export class QuestionTag {
  @PrimaryColumn({ type: 'uuid', name: 'question_id' })
  questionId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'category_tag_id' })
  categoryTagId!: string;

  @ManyToOne('Question', (question: Question) => question.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question!: Question;

  @ManyToOne('CategoryTag', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_tag_id' })
  categoryTag!: CategoryTag;
}
