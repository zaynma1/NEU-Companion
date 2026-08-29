import { IsString, IsISO8601, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreatePersonalEventDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsISO8601()
  startDatetime!: string;

  @IsISO8601()
  endDatetime!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @IsOptional()
  @IsISO8601()
  recurrenceEndDate?: string;
}

export class UpdatePersonalEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  startDatetime?: string;

  @IsOptional()
  @IsISO8601()
  endDatetime?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @IsOptional()
  @IsISO8601()
  recurrenceEndDate?: string;

  @IsOptional()
  @IsString()
  scope?: 'this_occurrence' | 'this_and_future' | 'entire_series';
}

export class CheckConflictsDto {
  @IsISO8601()
  startDatetime!: string;

  @IsISO8601()
  endDatetime!: string;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @IsOptional()
  @IsISO8601()
  recurrenceEndDate?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class GetTimetableQueryDto {
  @IsOptional()
  @IsString()
  term?: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsString()
  courseGroupId?: string;

  @IsOptional()
  @IsString()
  view?: 'day' | 'week' | 'month';
}

export class GetPersonalEventsQueryDto {
  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  includeRecurrences?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}
