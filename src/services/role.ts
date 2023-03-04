import { PERMLIST } from '@/utils';
import { Inject, Service } from 'typedi';

Service();
export default class RoleService {
  constructor(@Inject('roleModel') private roleModel: Models.RoleModel, @Inject('logger') private logger) {}

  getAllRoles() {
    return this.roleModel.find({}).lean();
  }

  async addRole(name: string, perms: string[]) {
    const filteredPerms = perms.filter(p => PERMLIST.includes(p));
    const existed = await this.roleModel.exists({ name });
    if (existed) {
      throw new Error(`Role ${name} already exists`);
    }
    return this.roleModel.create({ name, perms: filteredPerms });
  }

  getByName(name: string) {
    return this.roleModel.findOne({ name });
  }
}
