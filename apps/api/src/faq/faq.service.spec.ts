import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FaqService } from './faq.service';
import { CategoryTag } from './entities/category-tag.entity';
import { Question } from './entities/question.entity';
import { QuestionTag } from './entities/question-tag.entity';
import { Answer } from './entities/answer.entity';
import { QuestionVote } from './entities/question-vote.entity';
import { AnswerVote } from './entities/answer-vote.entity';
import { Report } from './entities/report.entity';
import { User } from '../auth/entities/user.entity';

describe('FaqService', () => {
  let service: FaqService;
  let questionRepository: any;
  let answerRepository: any;
  let tagRepository: any;
  let questionVoteRepository: any;
  let answerVoteRepository: any;
  let reportRepository: any;

  beforeEach(async () => {
    questionRepository = {
      create: jest.fn((dto: any) => dto),
      save: jest.fn(async (dto: any) => ({ id: 'question-1', ...dto })),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    answerRepository = {
      create: jest.fn((dto: any) => dto),
      save: jest.fn(async (dto: any) => ({ id: 'answer-1', ...dto })),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    tagRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto: any) => dto),
      save: jest.fn(async (dto: any) => dto),
    };

    questionVoteRepository = {
      findOne: jest.fn(),
      create: jest.fn((dto: any) => dto),
      save: jest.fn(async (dto: any) => dto),
      remove: jest.fn(),
      count: jest.fn(),
    };

    answerVoteRepository = {
      findOne: jest.fn(),
      create: jest.fn((dto: any) => dto),
      save: jest.fn(async (dto: any) => dto),
      remove: jest.fn(),
      count: jest.fn(),
    };

    reportRepository = {
      create: jest.fn((dto: any) => dto),
      save: jest.fn(async (dto: any) => ({ id: 'report-1', ...dto })),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqService,
        { provide: getRepositoryToken(CategoryTag), useValue: tagRepository },
        { provide: getRepositoryToken(Question), useValue: questionRepository },
        { provide: getRepositoryToken(QuestionTag), useValue: {} },
        { provide: getRepositoryToken(Answer), useValue: answerRepository },
        { provide: getRepositoryToken(QuestionVote), useValue: questionVoteRepository },
        { provide: getRepositoryToken(AnswerVote), useValue: answerVoteRepository },
        { provide: getRepositoryToken(Report), useValue: reportRepository },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();

    service = module.get<FaqService>(FaqService);
  });

  it('should create a question with valid tags', async () => {
    tagRepository.find.mockResolvedValue([
      { id: 'tag-1', label: 'math' },
      { id: 'tag-2', label: 'coursework' },
    ]);

    const result = await service.createQuestion('user-1', {
      title: 'How do I solve this?',
      body: 'Need help with the assignment',
      tags: ['math', 'coursework'],
    });

    expect(result).toBeDefined();
    expect(result.title).toBe('How do I solve this?');
    expect(result.status).toBe('open');
  });

  it('should reject duplicate votes on the same question', async () => {
    questionVoteRepository.findOne.mockResolvedValue({ userId: 'user-1', questionId: 'question-1', value: 'like' });

    await expect(
      service.createQuestionVote('question-1', 'user-1', { value: 'like' }),
    ).rejects.toThrow('You have already voted on this question');
  });

  it('should prevent more than one accepted answer per question', async () => {
    answerRepository.findOne.mockResolvedValue({ id: 'answer-1', questionId: 'question-1', isAccepted: false });
    questionRepository.findOne.mockResolvedValue({ id: 'question-1', authorId: 'question-owner', isLocked: false });
    answerRepository.findOne.mockResolvedValueOnce({ id: 'answer-1', questionId: 'question-1', isAccepted: false });
    answerRepository.findOne.mockResolvedValueOnce({ id: 'answer-old', questionId: 'question-1', isAccepted: true });

    await expect(
      service.acceptAnswer('answer-1', 'question-owner', 'student'),
    ).rejects.toThrow('This question already has an accepted answer');
  });
});
