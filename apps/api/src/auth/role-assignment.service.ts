import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleAssignmentRule } from './entities/role-assignment-rule.entity';
import { User } from './entities/user.entity';

export type UserRole = 'pending' | 'student' | 'professor' | 'admin';

@Injectable()
export class RoleAssignmentService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RoleAssignmentRule)
    private readonly roleAssignmentRuleRepository: Repository<RoleAssignmentRule>,
  ) {}

  async inferRoleForEmail(email: string): Promise<UserRole> {
    const normalizedEmail = email.trim().toLowerCase();
    const domain = normalizedEmail.split('@')[1]?.toLowerCase();

    if (!domain) {
      return 'pending';
    }

    const rules = await this.roleAssignmentRuleRepository.find({
      order: { priority: 'ASC' },
    });

    const match = rules.find((rule) => rule.domainPattern === domain);
    if (!match) {
      return 'pending';
    }

    return match.inferredRole;
  }

  async applyRoleFromEmail(userId: string, email: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const inferredRole = await this.inferRoleForEmail(email);
    if (inferredRole === 'pending') {
      return user;
    }

    user.role = inferredRole;
    return this.userRepository.save(user);
  }
}
