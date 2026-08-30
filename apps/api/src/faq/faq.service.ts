import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryTag } from './entities/category-tag.entity';
import { Question } from './entities/question.entity';
import { QuestionTag } from './entities/question-tag.entity';
import { Answer } from './entities/answer.entity';
import { QuestionVote } from './entities/question-vote.entity';
import { AnswerVote } from './entities/answer-vote.entity';
import { Report } from './entities/report.entity';
import { User } from '../auth/entities/user.entity';
import {
  AskQuestionDto,
  UpdateQuestionDto,
  CreateAnswerDto,
  UpdateAnswerDto,
  VoteDto,
  ReportDto,
  SearchQuestionsQueryDto,
  ResolveQuestionDto,
} from './dto/faq.dto';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(CategoryTag)
    private readonly tagRepository: Repository<CategoryTag>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(QuestionTag)
    private readonly questionTagRepository: Repository<QuestionTag>,
    @InjectRepository(Answer)
    private readonly answerRepository: Repository<Answer>,
    @InjectRepository(QuestionVote)
    private readonly questionVoteRepository: Repository<QuestionVote>,
    @InjectRepository(AnswerVote)
    private readonly answerVoteRepository: Repository<AnswerVote>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async listTags(): Promise<CategoryTag[]> {
    return this.tagRepository.find();
  }

  async searchQuestions(query: SearchQuestionsQueryDto) {
    const qb = this.questionRepository.createQueryBuilder('question');
    qb.leftJoinAndSelect('question.author', 'author');
    qb.leftJoinAndSelect('question.tags', 'tag');
    qb.leftJoinAndSelect('question.answers', 'answer');

    if (query.q) {
      qb.andWhere('(question.title ILIKE :q OR question.body ILIKE :q)', { q: `%${query.q}%` });
    }

    if (query.status) {
      qb.andWhere('question.status = :status', { status: query.status });
    }

    if (query.tags && query.tags.length > 0) {
      qb.andWhere('tag.label IN (:...tags)', { tags: query.tags });
    }

    qb.orderBy(query.sort === 'popular' ? 'question.createdAt' : 'question.createdAt', 'DESC');

    const pageSize = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    qb.take(pageSize + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > pageSize;

    return {
      items: rows.slice(0, pageSize),
      hasMore,
      nextCursor: hasMore ? rows[pageSize - 1]?.id : null,
    };
  }

  async getQuestionDetail(questionId: string): Promise<Question> {
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
      relations: { author: true, tags: true, answers: { author: true } },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return question;
  }

  async createQuestion(userId: string, dto: AskQuestionDto): Promise<Question> {
    if (!dto.title?.trim() || !dto.body?.trim()) {
      throw new BadRequestException('Title and body are required');
    }

    const tags = await this.validateTags(dto.tags ?? []);
    const question = this.questionRepository.create({
      title: dto.title.trim(),
      body: dto.body.trim(),
      authorId: userId,
      status: 'open',
      isLocked: false,
      editWindowExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      tags,
    });

    return this.questionRepository.save(question);
  }

  async updateQuestion(userId: string, questionId: string, dto: UpdateQuestionDto): Promise<Question> {
    const question = await this.questionRepository.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');
    if (question.authorId !== userId) throw new ForbiddenException('You do not own this question');
    if (question.isLocked) throw new BadRequestException('faq.question_locked');
    if (question.editWindowExpiresAt && question.editWindowExpiresAt < new Date()) {
      throw new BadRequestException('faq.edit_window_expired');
    }

    if (dto.title !== undefined) question.title = dto.title.trim();
    if (dto.body !== undefined) question.body = dto.body.trim();
    if (dto.tags) {
      const validTags = await this.validateTags(dto.tags);
      question.tags = validTags;
    }

    return this.questionRepository.save(question);
  }

  async resolveQuestion(userId: string, questionId: string, dto: ResolveQuestionDto): Promise<Question> {
    const question = await this.questionRepository.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');
    if (question.authorId !== userId) throw new ForbiddenException('Only the question author can resolve it');

    question.status = 'resolved';
    question.isLocked = true;
    if (dto?.resolutionNote) {
      question.resolutionNote = dto.resolutionNote;
    }

    return this.questionRepository.save(question);
  }

  async reopenQuestion(userId: string, questionId: string): Promise<Question> {
    const question = await this.questionRepository.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');
    if (question.authorId !== userId && !['professor', 'admin'].includes(userId)) {
      throw new ForbiddenException('You cannot reopen this question');
    }

    question.status = 'open';
    question.isLocked = false;

    return this.questionRepository.save(question);
  }

  async createAnswer(userId: string, questionId: string, dto: CreateAnswerDto): Promise<Answer> {
    if (!dto.body?.trim()) throw new BadRequestException('Answer body is required');

    const question = await this.questionRepository.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');
    if (question.isLocked) throw new BadRequestException('faq.question_locked');

    const answer = this.answerRepository.create({
      questionId,
      authorId: userId,
      body: dto.body.trim(),
      isAccepted: false,
    });

    return this.answerRepository.save(answer);
  }

  async updateAnswer(userId: string, answerId: string, dto: UpdateAnswerDto): Promise<Answer> {
    const answer = await this.answerRepository.findOne({ where: { id: answerId } });
    if (!answer) throw new NotFoundException('Answer not found');
    if (answer.authorId !== userId) throw new ForbiddenException('You do not own this answer');
    if (!dto.body?.trim()) throw new BadRequestException('Answer body is required');

    answer.body = dto.body.trim();
    return this.answerRepository.save(answer);
  }

  async acceptAnswer(answerId: string, actorId: string, actorRole?: string): Promise<Answer> {
    const answer = await this.answerRepository.findOne({ where: { id: answerId }, relations: { question: true } });
    if (!answer) throw new NotFoundException('Answer not found');

    const existingAccepted = await this.answerRepository.findOne({
      where: { questionId: answer.questionId, isAccepted: true },
    });

    if (existingAccepted && existingAccepted.id !== answer.id) {
      throw new BadRequestException('This question already has an accepted answer');
    }

    const question = await this.questionRepository.findOne({ where: { id: answer.questionId } });
    if (!question) throw new NotFoundException('Question not found');
    if (question.authorId !== actorId && actorRole !== 'admin' && actorRole !== 'professor') {
      throw new ForbiddenException('Only the question author, professor, or admin can accept an answer');
    }

    answer.isAccepted = true;
    return this.answerRepository.save(answer);
  }

  async unacceptAnswer(answerId: string, actorId: string, actorRole?: string): Promise<Answer> {
    const answer = await this.answerRepository.findOne({ where: { id: answerId }, relations: { question: true } });
    if (!answer) throw new NotFoundException('Answer not found');

    const question = await this.questionRepository.findOne({ where: { id: answer.questionId } });
    if (!question) throw new NotFoundException('Question not found');
    if (question.authorId !== actorId && actorRole !== 'admin' && actorRole !== 'professor') {
      throw new ForbiddenException('Only the question author, professor, or admin can unaccept an answer');
    }

    answer.isAccepted = false;
    return this.answerRepository.save(answer);
  }

  async createQuestionVote(questionId: string, userId: string, dto: VoteDto) {
    const existing = await this.questionVoteRepository.findOne({ where: { userId, questionId } });
    if (existing) {
      throw new BadRequestException('You have already voted on this question');
    }

    const question = await this.questionRepository.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');
    if (question.authorId === userId) throw new ForbiddenException('You cannot vote on your own question');

    const vote = this.questionVoteRepository.create({
      userId,
      questionId,
      value: dto.value,
    });

    return this.questionVoteRepository.save(vote);
  }

  async createAnswerVote(answerId: string, userId: string, dto: VoteDto) {
    const existing = await this.answerVoteRepository.findOne({ where: { userId, answerId } });
    if (existing) {
      throw new BadRequestException('You have already voted on this answer');
    }

    const answer = await this.answerRepository.findOne({ where: { id: answerId } });
    if (!answer) throw new NotFoundException('Answer not found');
    if (answer.authorId === userId) throw new ForbiddenException('You cannot vote on your own answer');

    const vote = this.answerVoteRepository.create({
      userId,
      answerId,
      value: dto.value,
    });

    return this.answerVoteRepository.save(vote);
  }

  async removeQuestionVote(questionId: string, userId: string): Promise<void> {
    const vote = await this.questionVoteRepository.findOne({ where: { userId, questionId } });
    if (!vote) return;
    await this.questionVoteRepository.remove(vote);
  }

  async removeAnswerVote(answerId: string, userId: string): Promise<void> {
    const vote = await this.answerVoteRepository.findOne({ where: { userId, answerId } });
    if (!vote) return;
    await this.answerVoteRepository.remove(vote);
  }

  async createReport(userId: string, dto: ReportDto) {
    if (!dto.reason?.trim()) throw new BadRequestException('Reason is required');

    const report = this.reportRepository.create({
      reporterId: userId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: dto.reason.trim(),
      status: 'open',
    });

    return this.reportRepository.save(report);
  }

  async hideQuestion(questionId: string, actorId: string) {
    const question = await this.questionRepository.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');
    question.hiddenAt = new Date();
    return this.questionRepository.save(question);
  }

  async hideAnswer(answerId: string, actorId: string) {
    const answer = await this.answerRepository.findOne({ where: { id: answerId } });
    if (!answer) throw new NotFoundException('Answer not found');
    answer.hiddenAt = new Date();
    return this.answerRepository.save(answer);
  }

  private async validateTags(tags: string[]): Promise<CategoryTag[]> {
    if (!tags || tags.length === 0) {
      return [];
    }

    const validTags = await this.tagRepository.find();
    const allowed = new Map(validTags.map((tag) => [tag.label, tag]));
    const selected = tags.map((label) => label.trim()).filter(Boolean);
    const invalid = selected.find((label) => !allowed.has(label));

    if (invalid) {
      throw new BadRequestException('faq.invalid_tag');
    }

    return selected.map((label) => allowed.get(label)!).filter(Boolean);
  }
}
