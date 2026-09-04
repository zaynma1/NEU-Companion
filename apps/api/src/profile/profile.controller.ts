import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ProfileService } from './profile.service';

@Controller()
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  async getCurrentProfile(@Req() req: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.getCurrentProfile(user.id),
    };
  }

  @Put('profile')
  async updateProfile(@Req() req: any, @Body() dto: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.updateProfile(user.id, dto),
    };
  }

  @Get('profile/visibility')
  async getVisibilitySettings(@Req() req: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.getVisibilitySettings(user.id),
    };
  }

  @Put('profile/visibility')
  async updateVisibilitySettings(@Req() req: any, @Body() dto: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.updateVisibilitySettings(user.id, dto),
    };
  }

  @Get('profile/contact-methods')
  async listContactMethods(@Req() req: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.listContactMethods(user.id),
    };
  }

  @Post('profile/contact-methods')
  async addContactMethod(@Req() req: any, @Body() dto: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.addContactMethod(user.id, dto),
    };
  }

  @Put('profile/contact-methods/:contactMethodId')
  async updateContactMethod(@Req() req: any, @Param('contactMethodId') contactMethodId: string, @Body() dto: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.updateContactMethod(user.id, contactMethodId, dto),
    };
  }

  @Delete('profile/contact-methods/:contactMethodId')
  async deleteContactMethod(@Req() req: any, @Param('contactMethodId') contactMethodId: string) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.deleteContactMethod(user.id, contactMethodId),
    };
  }

  @Get('professors')
  async getProfessorDirectory(@Query('q') q?: string, @Query('department') department?: string, @Query('limit') limit?: string) {
    return {
      status: 'success',
      data: await this.profileService.getProfessorDirectory(q, department, Number(limit ?? 20)),
    };
  }

  @Get('professors/:userId/profile')
  async getProfessorProfile(@Req() req: any, @Param('userId') userId: string) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.getProfessorProfile(user.id, userId),
    };
  }

  @Get('professors/:userId/office-hours')
  async getProfessorOfficeHours(@Req() req: any, @Param('userId') userId: string) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.getProfessorOfficeHours(user.id, userId),
    };
  }

  @Put('professors/:userId/office-hours')
  async upsertProfessorOfficeHours(@Req() req: any, @Param('userId') userId: string, @Body() dto: any) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.upsertProfessorOfficeHours(userId, req.user.id, req.user.role, dto),
    };
  }

  @Delete('professors/:userId/office-hours')
  async deleteProfessorOfficeHours(@Req() req: any, @Param('userId') userId: string) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    return {
      status: 'success',
      data: await this.profileService.deleteProfessorOfficeHours(userId, req.user.id, req.user.role),
    };
  }
}
