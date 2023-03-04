import { Inject, Service } from 'typedi';
import MailerService from './mailer';
import RoleService from './role';

Service();
export default class UserService {
  constructor(
    @Inject('userModel') private userModel: Models.UserModel,
    @Inject('whitelistModel') private whitelistModel: Models.WhitelistModel,
    private mailer: MailerService,
    private roleService: RoleService,
    @Inject('logger') private logger, // @EventDispatcher() private eventDispatcher: EventDispatcherInterface,
  ) {}

  getAllUsers() {
    return this.userModel.find({}).select('-password -salt').populate('role').lean().exec();
  }

  async whitelistEmail(email: string, addedById: string) {
    // create mongoose object in whitelist model
    // mongoose create if not exist
    const whitelisted = await this.whitelistModel.exists({ email });
    if (!whitelisted) {
      return this.whitelistModel.create({ email, addedBy: addedById });
    }
    return false;
  }

  async addRoleToUser(id: string, roleName: string) {
    const user = this.userModel.findOne({ _id: id });
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    const role = await this.roleService.getByName(roleName);
    if (!role) {
      throw new Error(`Role  not found`);
    }
    return user.updateOne({ role: role._id }).exec();
  }
}
