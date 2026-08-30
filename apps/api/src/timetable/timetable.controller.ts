import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { AuthGuard } from '../auth/auth.guard';
import {
  CreatePersonalEventDto,
  UpdatePersonalEventDto,
  CheckConflictsDto,
  GetTimetableQueryDto,
  GetPersonalEventsQueryDto,
} from './dtos/timetable.dto';

@Controller('api/v1')
@UseGuards(AuthGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get('timetable')
  async getTimetable(
    @Query() query: GetTimetableQueryDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.timetableService.getTimetable(user.id, query.startDate, query.endDate, query.courseGroupId),
    };
  }

  @Get('official-events/:eventId')
  async getOfficialEventDetail(
    @Param('eventId') eventId: string,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.timetableService.getOfficialEventDetail(eventId, user.id),
    };
  }

  @Get('personal-events')
  async getPersonalEvents(
    @Query() query: GetPersonalEventsQueryDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.timetableService.getPersonalEvents(user.id, query.startDate, query.endDate),
    };
  }

  @Post('personal-events')
  async createPersonalEvent(
    @Body() dto: CreatePersonalEventDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const personalEvent = await this.timetableService.createPersonalEvent(user.id, dto);
    const conflicts = await this.timetableService.checkConflicts(user.id, {
      startDatetime: dto.startDatetime,
      endDatetime: dto.endDatetime,
      recurrenceRule: dto.recurrenceRule,
      recurrenceEndDate: dto.recurrenceEndDate,
      title: dto.title,
      location: dto.location,
    });

    return {
      status: 'success',
      data: personalEvent,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  @Put('personal-events/:eventId')
  async updatePersonalEvent(
    @Param('eventId') eventId: string,
    @Body() dto: UpdatePersonalEventDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    const updatedEvent = await this.timetableService.updatePersonalEvent(eventId, user.id, dto);

    if (dto.startDatetime || dto.endDatetime) {
      const conflicts = await this.timetableService.checkConflicts(user.id, {
        startDatetime: dto.startDatetime ?? updatedEvent.startDatetime.toISOString(),
        endDatetime: dto.endDatetime ?? updatedEvent.endDatetime.toISOString(),
        recurrenceRule: dto.recurrenceRule ?? updatedEvent.recurrenceRule ?? undefined,
        recurrenceEndDate: dto.recurrenceEndDate ?? updatedEvent.recurrenceEndDate?.toISOString() ?? undefined,
        title: dto.title ?? updatedEvent.title,
        location: dto.location ?? updatedEvent.location ?? undefined,
      });

      return {
        status: 'success',
        data: updatedEvent,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      };
    }

    return {
      status: 'success',
      data: updatedEvent,
    };
  }

  @Delete('personal-events/:eventId')
  async deletePersonalEvent(
    @Param('eventId') eventId: string,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    await this.timetableService.deletePersonalEvent(eventId, user.id);

    return {
      status: 'success',
      message: 'Personal event deleted successfully',
    };
  }

  @Post('personal-events/conflicts')
  async checkConflicts(
    @Body() dto: CheckConflictsDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.timetableService.checkConflicts(user.id, dto),
    };
  }

  @Get('course-groups/:groupId/official-events')
  async getOfficialEventsForCourseGroup(
    @Param('groupId') groupId: string,
    @Query() query: GetTimetableQueryDto,
    @Request() req: any,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.timetableService.getOfficialEventsForCourseGroup(
        groupId,
        user.id,
        query.startDate,
        query.endDate,
      ),
    };
  }
}
