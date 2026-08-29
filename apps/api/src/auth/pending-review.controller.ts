import { Body, Controller, Get, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class ReviewDecisionDto {
  decision!: 'approved' | 'rejected' | 'reassigned';
  proposedRole?: 'student' | 'professor' | 'admin';
  resolutionNotes?: string;
}

@Controller('admin')
export class PendingReviewController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Get('pending-review')
  async listPendingReview(@Req() req: Request & { user?: { id: string; role?: string } }) {
    const items = await this.authService.listPendingReviewItems();

    return {
      ok: true,
      actorUserId: req.user?.id,
      items,
    };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Post('pending-review/:itemId/decision')
  async decidePendingReview(
    @Req() req: Request & { user?: { id: string; role?: string } },
    @Param('itemId') itemId: string,
    @Body() body: ReviewDecisionDto,
  ) {
    if (!body.decision) {
      throw new UnauthorizedException('Decision is required');
    }

    const result = await this.authService.decidePendingReviewItem({
      itemId,
      decision: body.decision,
      actorUserId: req.user?.id ?? 'unknown-admin',
      proposedRole: body.proposedRole,
      resolutionNotes: body.resolutionNotes,
    });

    return {
      ok: true,
      itemId: result.id,
      decision: result.decision,
      role: result.proposedRole ?? null,
    };
  }
}
