"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderController_1 = require("../controllers/ecom/orderController");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const validateRequest_1 = require("../middleware/validateRequest");
const authMiddleware_1 = require("../middleware/authMiddleware");
const orderRouter = express_1.default.Router();
// Route for users to place orders
orderRouter.post('/', authMiddleware_1.authenticateToken, (0, validationMiddleware_1.orderValidationRules)(), validateRequest_1.validateRequest, orderController_1.createOrderController);
// Routes for viewing orders
orderRouter.get('/me', authMiddleware_1.authenticateToken, orderController_1.getUserOrdersController); // Users can view their own orders
orderRouter.get('/:id', authMiddleware_1.authenticateToken, (0, validationMiddleware_1.idValidationRules)(), validateRequest_1.validateRequest, orderController_1.getOrderByIdController);
exports.default = orderRouter;
