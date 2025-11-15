import express from 'express';
import { getProducts, getProductById } from '../controllers/admin/ecom/productController';
import {  getAllCategories, getProductsByCategory } from '../controllers/admin/ecom/categoryController';
import { idValidationRules } from '../middleware/validationMiddleware';
import { validateRequest } from '../middleware/validateRequest';


const productRouter = express.Router();

productRouter.get('/', getProducts);
productRouter.get('/:id', idValidationRules(), validateRequest, getProductById);

productRouter.get('/categories/all', getAllCategories);
productRouter.get('/category/:categoryName', getProductsByCategory);



export default productRouter;
