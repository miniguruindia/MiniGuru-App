import express from 'express';
import { createProduct, updateProduct, deleteProduct } from '../controllers/admin/ecom/productController';
import { deleteProjectByID } from '../controllers/project/projectController';
import { createProductCategory, deleteProductCategory, updateProductCategory} from '../controllers/admin/ecom/categoryController';
import { createProjectCategory, deleteProjectCategory, updateProjectCategory } from '../controllers/project/categoryController';
import { productValidationRules, idValidationRules, updateUserValidationRules } from '../middleware/validationMiddleware';
import { authenticateToken , authorizeAdmin } from '../middleware/authMiddleware';
import { uploadImagesMiddleware} from '../middleware/upload';
import { listUsers, getUserById , deleteUserById, updateUserDetails } from '../controllers/auth/userController';
import { getAllOrdersController } from '../controllers/ecom/orderController';

import { fetchStats } from '../controllers/admin/statsController';

const adminRouter = express.Router();

//product routes
adminRouter.post('/product', authenticateToken, authorizeAdmin, productValidationRules(), uploadImagesMiddleware, createProduct);
adminRouter.put('/product/:id', authenticateToken, authorizeAdmin, idValidationRules(), productValidationRules(), uploadImagesMiddleware, updateProduct);
adminRouter.delete('/product/:id', authenticateToken, authorizeAdmin, idValidationRules(), deleteProduct);
adminRouter.post('/product/category', authenticateToken, authorizeAdmin, createProductCategory);
adminRouter.delete('/product/category/:id', authenticateToken, authorizeAdmin,deleteProductCategory);
adminRouter.put('/product/category/:id', authenticateToken, authorizeAdmin,updateProductCategory);


adminRouter.post('/project/category', authenticateToken, authorizeAdmin, createProjectCategory)
adminRouter.delete('/project/category/:id', authenticateToken, authorizeAdmin, deleteProjectCategory)
adminRouter.put('/project/category/:id', authenticateToken, authorizeAdmin, updateProjectCategory)

adminRouter.get('/users', authenticateToken, authorizeAdmin, listUsers);
adminRouter.get('/users/:userId', authenticateToken, authorizeAdmin, getUserById);
adminRouter.delete('/users/:userId', authenticateToken, authorizeAdmin, deleteUserById);
adminRouter.put('/users/:userId', authenticateToken, authorizeAdmin, updateUserDetails, updateUserValidationRules);

adminRouter.delete('/project/:id', authenticateToken, authorizeAdmin, deleteProjectByID);

adminRouter.get('/orders', authenticateToken, authorizeAdmin, getAllOrdersController);

adminRouter.get('/stats',authenticateToken,authorizeAdmin,fetchStats)

export default adminRouter