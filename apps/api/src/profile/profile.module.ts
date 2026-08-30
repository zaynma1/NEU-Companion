import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { Profile } from './entities/profile.entity';
import { ContactMethod } from './entities/contact-method.entity';
import { VisibilitySetting } from './entities/visibility-setting.entity';
import { ProfessorScheduleDocument } from './entities/professor-schedule-document.entity';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Profile, ContactMethod, VisibilitySetting, ProfessorScheduleDocument, User]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
