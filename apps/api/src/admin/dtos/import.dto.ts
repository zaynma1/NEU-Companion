import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class UploadImportDto {
  @IsString()
  term!: string;

  @IsString()
  templateVersion!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // file will be handled by multer middleware
  file?: Express.Multer.File;
}

export class ApplyImportDto {
  @IsOptional()
  @IsBoolean()
  destructiveChangeConfirmation?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RollbackImportDto {
  @IsString()
  term!: string;

  @IsUUID()
  datasetVersionId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RetryImportDto {
  @IsOptional()
  @IsString()
  notes?: string;

  // file will be handled by multer middleware if provided
  file?: Express.Multer.File;
}

export class ListImportsQueryDto {
  @IsOptional()
  @IsString()
  term?: string;

  @IsOptional()
  @IsString()
  status?: 'validating' | 'validated' | 'failed' | 'applied' | 'rolled_back' | 'expired';

  @IsOptional()
  @IsUUID()
  uploadedBy?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsString()
  limit!: string; // 1..100

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ListDatasetVersionsQueryDto {
  @IsString()
  limit!: string; // 1..100

  @IsOptional()
  @IsString()
  cursor?: string;
}
