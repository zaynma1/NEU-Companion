import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

type UploadedFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  stream: NodeJS.ReadableStream;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
};
import { AdminImportService } from './admin-import.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ApplyImportDto, RollbackImportDto, RetryImportDto, ListImportsQueryDto, ListDatasetVersionsQueryDto } from './dtos/import.dto';

@Controller('api/v1/admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminImportController {
  constructor(private readonly adminImportService: AdminImportService) {}

  @Post('imports')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadImport(
    @UploadedFile() file: UploadedFile,
    @Body() body: any,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!body.term || !body.templateVersion) {
      throw new BadRequestException('term and templateVersion are required');
    }

    const batch = await this.adminImportService.uploadImport(
      user.id,
      body.term,
      body.templateVersion,
      file.buffer,
      file.originalname,
    );

    return {
      status: 'success',
      data: {
        batchId: batch.id,
        status: batch.status,
        term: batch.term,
      },
    };
  }

  @Get('imports/:batchId')
  async getImportStatus(@Param('batchId') batchId: string, @Request() req: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const batch = await this.adminImportService.getImportBatch(batchId);

    return {
      status: 'success',
      data: batch,
    };
  }

  @Get('imports')
  async listImports(@Query() query: ListImportsQueryDto, @Request() req: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const limit = Math.min(parseInt(query.limit) || 10, 100);

    const result = await this.adminImportService.listImportBatches(
      query.term,
      query.status,
      limit,
      query.cursor,
    );

    return {
      status: 'success',
      data: result.batches,
      nextCursor: result.nextCursor,
    };
  }

  @Get('imports/:batchId/errors')
  async getImportErrors(
    @Param('batchId') batchId: string,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursorStr?: string,
    @Request() req: any = {},
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const limit = Math.min(parseInt(limitStr || '100'), 500);
    const cursor = cursorStr ? parseInt(cursorStr) : undefined;

    const result = await this.adminImportService.getImportErrors(batchId, limit, cursor);

    return {
      status: 'success',
      data: result.errors,
      nextCursor: result.nextCursor,
    };
  }

  @Get('imports/:batchId/diff')
  async getImportDiff(@Param('batchId') batchId: string, @Request() req: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const diff = await this.adminImportService.getImportDiff(batchId);

    return {
      status: 'success',
      data: diff,
    };
  }

  @Post('imports/:batchId/apply')
  async applyImport(
    @Param('batchId') batchId: string,
    @Body() dto: ApplyImportDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const version = await this.adminImportService.applyImport(batchId, user.id, dto);

    return {
      status: 'success',
      data: {
        datasetVersionId: version.id,
        term: version.term,
        publishedAt: version.publishedAt,
        isCurrent: version.isCurrent,
      },
    };
  }

  @Post('imports/rollback')
  async rollbackImport(
    @Body() dto: RollbackImportDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const version = await this.adminImportService.rollbackImport(user.id, dto);

    return {
      status: 'success',
      data: {
        datasetVersionId: version.id,
        term: version.term,
        publishedAt: version.publishedAt,
        isCurrent: version.isCurrent,
      },
    };
  }

  @Get('terms/:term/dataset-versions')
  async listDatasetVersions(
    @Param('term') term: string,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
    @Request() req: any = {},
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const limit = Math.min(parseInt(limitStr || '10'), 100);

    const result = await this.adminImportService.listDatasetVersions(term, limit, cursor);

    return {
      status: 'success',
      data: result.versions,
      nextCursor: result.nextCursor,
    };
  }

  @Get('terms/:term/current-dataset')
  async getCurrentDataset(
    @Param('term') term: string,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const version = await this.adminImportService.getCurrentDataset(term);

    return {
      status: 'success',
      data: {
        datasetVersionId: version.id,
        publishedAt: version.publishedAt,
      },
    };
  }

  @Post('imports/:batchId/retry')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async retryImport(
    @Param('batchId') batchId: string,
    @UploadedFile() file: UploadedFile | undefined,
    @Body() dto: RetryImportDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    // For now, just acknowledge the retry request
    // In production, this would re-validate and potentially re-upload
    return {
      status: 'success',
      message: 'Retry request accepted',
      data: {
        batchId,
        status: 'validating',
      },
    };
  }
}
