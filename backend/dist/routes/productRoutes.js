"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productController_1 = require("../controllers/admin/ecom/productController");
const categoryController_1 = require("../controllers/admin/ecom/categoryController");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const validateRequest_1 = require("../middleware/validateRequest");
const productRouter = express_1.default.Router();
productRouter.get('/', productController_1.getProducts);
productRouter.get('/:id', (0, validationMiddleware_1.idValidationRules)(), validateRequest_1.validateRequest, productController_1.getProductById);
productRouter.get('/categories/all', categoryController_1.getAllCategories);
productRouter.get('/category/:categoryName', categoryController_1.getProductsByCategory);
exports.default = productRouter;
