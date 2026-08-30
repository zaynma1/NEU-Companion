import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { ContactMethod } from './entities/contact-method.entity';
import { ProfessorScheduleDocument } from './entities/professor-schedule-document.entity';
import { Profile } from './entities/profile.entity';
import { VisibilitySetting } from './entities/visibility-setting.entity';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(ContactMethod)
    private readonly contactMethodRepository: Repository<ContactMethod>,
    @InjectRepository(VisibilitySetting)
    private readonly visibilitySettingRepository: Repository<VisibilitySetting>,
    @InjectRepository(ProfessorScheduleDocument)
    private readonly professorDocumentRepository: Repository<ProfessorScheduleDocument>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getCurrentProfile(userId: string) {
    let profile = await this.profileRepository.findOne({ where: { userId } });

    if (!profile) {
      profile = this.profileRepository.create({
        userId,
        photoUrl: null,
        verificationStatus: 'unverified',
        createdAt: new Date(),
      });
      await this.profileRepository.save(profile);
    }

    const contactMethods = await this.contactMethodRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });

    const visibilitySettings = await this.visibilitySettingRepository.find({
      where: { userId },
    });

    return {
      ...profile,
      contactMethods,
      visibilitySettings,
    };
  }

  async updateProfile(
    userId: string,
    dto: { username?: string; preferredContactMethod?: string; photoUrl?: string | null },
  ) {
    const profile = await this.getCurrentProfile(userId);

    if (dto.username !== undefined) {
      const trimmed = dto.username.trim();
      if (!trimmed) {
        throw new BadRequestException('Username cannot be empty');
      }

      const existingUser = await this.userRepository.findOne({ where: { username: trimmed } });
      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException('Profile.username_taken');
      }

      const ownedUser = await this.userRepository.findOne({ where: { id: userId } });
      if (!ownedUser) {
        throw new NotFoundException('User not found');
      }
      ownedUser.username = trimmed;
      await this.userRepository.save(ownedUser);
    }

    if (dto.photoUrl !== undefined) {
      profile.photoUrl = dto.photoUrl;
    }

    if (dto.preferredContactMethod !== undefined) {
      const contactIds = dto.preferredContactMethod.split(',').map((id) => id.trim()).filter(Boolean);
      await this.setPreferredContactMethod(userId, contactIds[0] ?? null);
    }

    return this.profileRepository.save(profile);
  }

  async getVisibilitySettings(userId: string) {
    return this.visibilitySettingRepository.find({ where: { userId } });
  }

  async updateVisibilitySettings(userId: string, payload: { fieldName: string; visibilityLevel: string }) {
    const validFields = ['real_name', 'username', 'email', 'contact_method'];
    const validLevels = ['public', 'course_members_only', 'private'];

    if (!validFields.includes(payload.fieldName)) {
      throw new BadRequestException('profile.invalid_field_name');
    }

    if (!validLevels.includes(payload.visibilityLevel)) {
      throw new BadRequestException('profile.invalid_visibility_level');
    }

    const existing = await this.visibilitySettingRepository.findOne({
      where: { userId, fieldName: payload.fieldName as any },
    });

    if (existing) {
      existing.visibilityLevel = payload.visibilityLevel as any;
      return this.visibilitySettingRepository.save(existing);
    }

    const next = this.visibilitySettingRepository.create({
      userId,
      fieldName: payload.fieldName as any,
      visibilityLevel: payload.visibilityLevel as any,
    });

    return this.visibilitySettingRepository.save(next);
  }

  async listContactMethods(userId: string) {
    return this.contactMethodRepository.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  async addContactMethod(
    userId: string,
    dto: { methodType: 'email' | 'phone' | 'office_location' | 'other'; value: string; isPreferred?: boolean },
  ) {
    const allowed = ['email', 'phone', 'office_location', 'other'];
    if (!allowed.includes(dto.methodType)) {
      throw new BadRequestException('profile.invalid_contact_method');
    }

    const entity = this.contactMethodRepository.create({
      userId,
      methodType: dto.methodType,
      value: dto.value.trim(),
      isPreferred: dto.isPreferred ?? false,
    });

    if (dto.isPreferred) {
      await this.clearPreferredContactMethods(userId, entity.id);
    }

    return this.contactMethodRepository.save(entity);
  }

  async updateContactMethod(userId: string, contactMethodId: string, dto: Partial<ContactMethod>) {
    const contact = await this.contactMethodRepository.findOne({ where: { id: contactMethodId, userId } });
    if (!contact) {
      throw new NotFoundException('Contact method not found');
    }

    if (dto.methodType) {
      contact.methodType = dto.methodType;
    }

    if (dto.value !== undefined) {
      contact.value = dto.value.trim();
    }

    if (dto.isPreferred !== undefined) {
      contact.isPreferred = dto.isPreferred;
      if (dto.isPreferred) {
        await this.clearPreferredContactMethods(userId, contact.id);
        contact.isPreferred = true;
      }
    }

    return this.contactMethodRepository.save(contact);
  }

  async deleteContactMethod(userId: string, contactMethodId: string) {
    const contact = await this.contactMethodRepository.findOne({ where: { id: contactMethodId, userId } });
    if (!contact) {
      throw new NotFoundException('Contact method not found');
    }

    await this.contactMethodRepository.remove(contact);
    return { deleted: true, contactMethodId };
  }

  private async setPreferredContactMethod(userId: string, contactMethodId: string | null) {
    if (!contactMethodId) {
      return;
    }

    await this.clearPreferredContactMethods(userId, contactMethodId);
    const contact = await this.contactMethodRepository.findOne({ where: { id: contactMethodId, userId } });
    if (!contact) {
      throw new NotFoundException('Contact method not found');
    }
    contact.isPreferred = true;
    await this.contactMethodRepository.save(contact);
  }

  private async clearPreferredContactMethods(userId: string, keepId?: string) {
    const currentPreferred = await this.contactMethodRepository.find({
      where: { userId, isPreferred: true },
    });

    for (const contact of currentPreferred) {
      if (keepId && contact.id === keepId) {
        continue;
      }
      contact.isPreferred = false;
      await this.contactMethodRepository.save(contact);
    }
  }

  async getProfessorDirectory(q?: string, department?: string, limit = 20) {
    const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const qb = this.userRepository.createQueryBuilder('user');
    qb.leftJoinAndSelect('user.profile', 'profile');
    qb.where('user.role = :role', { role: 'professor' });

    if (q) {
      qb.andWhere('(user.fullName ILIKE :query OR user.username ILIKE :query)', { query: `%${q}%` });
    }

    if (department) {
      qb.andWhere('user.department = :department', { department });
    }

    qb.orderBy('user.fullName', 'ASC');
    qb.take(pageLimit);

    const items = await qb.getMany();

    return {
      items: items.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        department: user.department,
        verificationStatus: user.professorVerifiedAt ? 'verified' : 'unverified',
      })),
      limit: pageLimit,
    };
  }

  async getProfessorProfile(viewerUserId: string, targetUserId: string) {
    const user = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('Professor profile not found');
    }

    if (user.role !== 'professor' && user.role !== 'admin') {
      throw new NotFoundException('Professor profile not found');
    }

    const profile = await this.getCurrentProfile(targetUserId);
    const document = await this.professorDocumentRepository.findOne({ where: { professorId: targetUserId } });

    return {
      ...profile,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        department: user.department,
        verificationStatus: user.professorVerifiedAt ? 'verified' : 'unverified',
      },
      officeHoursDocument: document
        ? {
            id: document.id,
            fileUrl: document.fileUrl,
            mimeType: document.mimeType,
            uploadedAt: document.uploadedAt,
            officeHoursSummary: document.officeHoursSummary,
          }
        : null,
      viewerUserId,
    };
  }

  async getProfessorOfficeHours(viewerUserId: string, professorId: string) {
    const professor = await this.userRepository.findOne({ where: { id: professorId } });
    if (!professor) {
      throw new NotFoundException('Professor not found');
    }

    const document = await this.professorDocumentRepository.findOne({ where: { professorId } });
    if (!document) {
      throw new NotFoundException('Office-hours document not found');
    }

    if (!viewerUserId) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      id: document.id,
      fileUrl: document.fileUrl,
      mimeType: document.mimeType,
      uploadedAt: document.uploadedAt,
      officeHoursSummary: document.officeHoursSummary,
    };
  }

  async upsertProfessorOfficeHours(
    professorId: string,
    dto: { fileUrl?: string; mimeType?: string; fileSizeBytes?: number; officeHoursSummary?: string | null },
  ) {
    const professor = await this.userRepository.findOne({ where: { id: professorId } });
    if (!professor) {
      throw new NotFoundException('Professor not found');
    }

    const supportedMime = ['application/pdf', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const mimeType = dto.mimeType ?? 'application/pdf';
    if (mimeType && !supportedMime.includes(mimeType)) {
      throw new BadRequestException('document.unsupported_format');
    }

    const existing = await this.professorDocumentRepository.findOne({ where: { professorId } });

    if (existing) {
      existing.fileUrl = dto.fileUrl ?? existing.fileUrl;
      existing.mimeType = mimeType;
      existing.fileSizeBytes = dto.fileSizeBytes ?? existing.fileSizeBytes;
      existing.officeHoursSummary = dto.officeHoursSummary ?? existing.officeHoursSummary;
      existing.uploadedAt = new Date();
      return this.professorDocumentRepository.save(existing);
    }

    const document = this.professorDocumentRepository.create({
      professorId,
      fileUrl: dto.fileUrl ?? null,
      mimeType,
      fileSizeBytes: dto.fileSizeBytes ?? null,
      officeHoursSummary: dto.officeHoursSummary ?? null,
      uploadedAt: new Date(),
    });

    return this.professorDocumentRepository.save(document);
  }

  async deleteProfessorOfficeHours(professorId: string) {
    const document = await this.professorDocumentRepository.findOne({ where: { professorId } });
    if (!document) {
      throw new NotFoundException('Office-hours document not found');
    }

    await this.professorDocumentRepository.remove(document);
    return { deleted: true, professorId };
  }
}
