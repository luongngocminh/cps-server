export interface IUser {
  _id: string;
  name: string;
  email: string;
  password: string;
  salt: string;
  role: string;
  isAdmin?: boolean;
}

export interface IUserInputDTO {
  name?: string;
  fullName?: string;
  email: string;
  password: string;
}
