"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllOrdersController = exports.getUserOrdersController = exports.getOrderByIdController = exports.createOrderController = void 0;
const order_1 = require("../../services/ecom/order");
const error_1 = require("../../utils/error");
const logger_1 = __importDefault(require("../../logger"));
// Utility function to handle sending error responses
const handleControllerError = (error, res) => {
    if (error instanceof error_1.NotFoundError) {
        return res.status(404).json({ message: error.message });
    }
    if (error instanceof error_1.ServiceError) {
        return res.status(400).json({ message: error.message });
    }
    logger_1.default.error(`Unexpected error: ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
};
// Create an order
const createOrderController = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { products, deliveryAddress } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: 'Products array is required and must contain at least one item.' });
    }
    try {
        const order = await (0, order_1.createOrder)({ userId, products, deliveryAddress });
        return res.status(201).json(order);
    }
    catch (error) {
        handleControllerError(error, res);
    }
};
exports.createOrderController = createOrderController;
// Get order by ID
const getOrderByIdController = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { orderId } = req.params;
    try {
        const order = await (0, order_1.getOrderById)(userId, orderId);
        if (!order) {
            return res.status(404).json({ message: `Order with ID ${orderId} not found.` });
        }
        return res.status(200).json(order);
    }
    catch (error) {
        handleControllerError(error, res);
    }
};
exports.getOrderByIdController = getOrderByIdController;
// Get all orders for a user
const getUserOrdersController = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    try {
        const orders = await (0, order_1.getUserOrders)(userId);
        // if (!orders) {
        //     return res.status(404).json({ message: `No orders found for user ${userId}.` });
        // }
        return res.status(200).json(orders);
    }
    catch (error) {
        handleControllerError(error, res);
    }
};
exports.getUserOrdersController = getUserOrdersController;
const getAllOrdersController = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId && req.user?.role !== "ADMIN")
        return res.status(401).json({ error: "Unauthorized" });
    try {
        const orders = await (0, order_1.getAllOrders)();
        return res.status(200).json(orders);
    }
    catch (error) {
        handleControllerError(error, res);
    }
};
exports.getAllOrdersController = getAllOrdersController;
