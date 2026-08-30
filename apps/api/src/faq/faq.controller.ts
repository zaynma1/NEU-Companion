import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FaqService } from './faq.service';
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

@Controller('api/v1/faq')
@UseGuards(AuthGuard)
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get('tags')
  async listTags() {
    const tags = await this.faqService.listTags();
    return { status: 'success', data: tags };
  }

  @Get('questions')
  async searchQuestions(@Query() query: SearchQuestionsQueryDto) {
    const result = await this.faqService.searchQuestions(query);
    return { status: 'success', data: result }; 
  }

  @Get('questions/:questionId')
  async getQuestionDetail(@Param('questionId') questionId: string) {
    const question = await this.faqService.getQuestionDetail(questionId);
    return { status: 'success', data: question };
  }

  @Post('questions')
  async askQuestion(@Request() req: any, @Body() dto: AskQuestionDto) {
    const question = await this.faqService.createQuestion(req.user.id, dto);
    return { status: 'success', data: question };
  }

  @Put('questions/:questionId')
  async updateQuestion(@Request() req: any, @Param('questionId') questionId: string, @Body() dto: UpdateQuestionDto) {
    const question = await this.faqService.updateQuestion(req.user.id, questionId, dto);
    return { status: 'success', data: question };
  }

  @Post('questions/:questionId/resolve')
  async resolveQuestion(@Request() req: any, @Param('questionId') questionId: string, @Body() dto: ResolveQuestionDto) {
    const question = await this.faqService.resolveQuestion(req.user.id, questionId, dto);
    return { status: 'success', data: question };
  }

  @Post('questions/:questionId/reopen')
  async reopenQuestion(@Request() req: any, @Param('questionId') questionId: string) {
    const question = await this.faqService.reopenQuestion(req.user.id, questionId);
    return { status: 'success', data: question };
  }

  @Post('questions/:questionId/answers')
  async createAnswer(@Request() req: any, @Param('questionId') questionId: string, @Body() dto: CreateAnswerDto) {
    const answer = await this.faqService.createAnswer(req.user.id, questionId, dto);
    return { status: 'success', data: answer };
  }

  @Put('answers/:answerId')
  async updateAnswer(@Request() req: any, @Param('answerId') answerId: string, @Body() dto: UpdateAnswerDto) {
    const answer = await this.faqService.updateAnswer(req.user.id, answerId, dto);
    return { status: 'success', data: answer };
  }

  @Post('answers/:answerId/accept')
  async acceptAnswer(@Request() req: any, @Param('answerId') answerId: string) {
    const item = await this.faqService.acceptAnswer(answerId, req.user.id, req.user.role);
    return { status: 'success', data: item };
  }

  @Post('answers/:answerId/unaccept')
  async unacceptAnswer(@Request() req: any, @Param('answerId') answerId: string) {
    const item = await this.faqService.unacceptAnswer(answerId, req.user.id, req.user.role);
    return { status: 'success', data: item };
  }

  @Post('questions/:questionId/votes')
  async createQuestionVote(@Request() req: any, @Param('questionId') questionId: string, @Body() dto: VoteDto) {
    const vote = await this.faqService.createQuestionVote(questionId, req.user.id, dto);
    return { status: 'success', data: vote };
  }

  @Post('answers/:answerId/votes')
  async createAnswerVote(@Request() req: any, @Param('answerId') answerId: string, @Body() dto: VoteDto) {
    const vote = await this.faqService.createAnswerVote(answerId, req.user.id, dto);
    return { status: 'success', data: vote };
  }

  @Delete('questions/:questionId/votes')
  async removeQuestionVote(@Request() req: any, @Param('questionId') questionId: string) {
    await this.faqService.removeQuestionVote(questionId, req.user.id);
    return { status: 'success' };
  }

  @Delete('answers/:answerId/votes')
  async removeAnswerVote(@Request() req: any, @Param('answerId') answerId: string) {
    await this.faqService.removeAnswerVote(answerId, req.user.id);
    return { status: 'success' };
  }

  @Post('reports')
  async createReport(@Request() req: any, @Body() dto: ReportDto) {
    const report = await this.faqService.createReport(req.user.id, dto);
    return { status: 'success', data: report };
  }

  @Post('questions/:questionId/hide')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async hideQuestion(@Request() req: any, @Param('questionId') questionId: string) {
    const question = await this.faqService.hideQuestion(questionId, req.user.id);
    return { status: 'success', data: question };
  }

  @Post('answers/:answerId/hide')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async hideAnswer(@Request() req: any, @Param('answerId') answerId: string) {
    const answer = await this.faqService.hideAnswer(answerId, req.user.id);
    return { status: 'success', data: answer };
  }
}
