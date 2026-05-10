import { IUser } from '../models/User';

declare global {
    namespace Express {
        interface Request {
            user?: IUser & { _id: import('mongoose').Types.ObjectId };
            branchId?: string;
        }
    }
}

export { };
