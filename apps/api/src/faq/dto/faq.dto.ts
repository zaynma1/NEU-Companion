import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AskQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ResolveQuestionDto {
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}

export class CreateAnswerDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

export class UpdateAnswerDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

export class VoteDto {
  @IsEnum(['like', 'dislike'])
  value!: 'like' | 'dislike';
}

export class ReportDto {
  @IsEnum(['question', 'answer'])
  targetType!: 'question' | 'answer';

  @IsUUID()
  targetId!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}

export class SearchQuestionsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(['open', 'answered', 'resolved'])
  status?: 'open' | 'answered' | 'resolved';

  @IsOptional()
  @IsEnum(['newest', 'popular'])
  sort?: 'newest' | 'popular';

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
