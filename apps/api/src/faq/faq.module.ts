import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';
import { CategoryTag } from './entities/category-tag.entity';
import { Question } from './entities/question.entity';
import { QuestionTag } from './entities/question-tag.entity';
import { Answer } from './entities/answer.entity';
import { QuestionVote } from './entities/question-vote.entity';
import { AnswerVote } from './entities/answer-vote.entity';
import { Report } from './entities/report.entity';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      CategoryTag,
      Question,
      QuestionTag,
      Answer,
      QuestionVote,
      AnswerVote,
      Report,
      User,
    ]),
  ],
  controllers: [FaqController],
  providers: [FaqService, RolesGuard],
  exports: [FaqService],
})
export class FaqModule {}
