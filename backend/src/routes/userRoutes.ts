import { Router } from 'express';
import { getUserDetails, updateUserDetails } from '../controllers/auth/userController';
import { authenticateToken } from '../middleware/authMiddleware';
import { updateUserValidationRules} from '../middleware/validationMiddleware';
import { getAllTransactions } from '../controllers/ecom/walletControllers';

const userRouter = Router();

userRouter.get('/', authenticateToken, getUserDetails);
userRouter.get('/wallet',authenticateToken,getAllTransactions)

userRouter.put('/', authenticateToken, updateUserDetails, updateUserValidationRules);

export default userRouter;
