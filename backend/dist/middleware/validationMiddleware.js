"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProject = exports.updateUserValidationRules = exports.idValidationRules = exports.orderValidationRules = exports.productValidationRules = exports.registerValidationRules = exports.createRazorPayOrderValidation = exports.verifyRazorpayTransactionValidation = void 0;
const express_validator_1 = require("express-validator");
const registerValidationRules = () => {
    return [
        (0, express_validator_1.body)('email').isEmail().withMessage('Invalid email address'),
        (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
        (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required'),
        (0, express_validator_1.body)('age').isInt({ min: 0 }).withMessage('Age must be a positive number'),
        // body('role').isIn(['user', 'admin']).withMessage('Role must be either user or admin'),
    ];
};
exports.registerValidationRules = registerValidationRules;
const updateUserValidationRules = [
    (0, express_validator_1.check)('email').optional().isEmail().withMessage('Invalid email format'),
    (0, express_validator_1.check)('name').optional().isLength({ min: 3 }).withMessage('Name must be at least 3 characters long'),
    (0, express_validator_1.check)('age').optional().isInt({ min: 1 }).withMessage('Age must be a positive integer'),
];
exports.updateUserValidationRules = updateUserValidationRules;
const productValidationRules = () => {
    return [
        (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required'),
        (0, express_validator_1.body)('description').notEmpty().withMessage('Description is required'),
        (0, express_validator_1.body)('price').isFloat({ gt: 0 }).withMessage('Price must be a positive number'),
        (0, express_validator_1.body)('inventory').isInt({ gt: 0 }).withMessage('Inventory must be a positive integer'),
        (0, express_validator_1.body)('categoryName').notEmpty().withMessage('Category is required'),
        // body('images').isArray().withMessage('Images must be an array of URLs'),
    ];
};
exports.productValidationRules = productValidationRules;
const orderValidationRules = () => {
    return [
        (0, express_validator_1.body)('products').isArray().withMessage('Products must be an array'),
        (0, express_validator_1.body)('products.*.id').notEmpty().withMessage('Product ID is required'),
        (0, express_validator_1.body)('products.*.quantity').isInt({ gt: 0 }).withMessage('Quantity must be a positive integer'),
    ];
};
exports.orderValidationRules = orderValidationRules;
// const idValidationRules = () => {
//     return [
//         param('id').isUUID().withMessage('Invalid ID format'),
//     ];
// };
const isValidObjectId = (value) => {
    const objectIdRegex = /^[a-fA-F0-9]{24}$/;
    return objectIdRegex.test(value);
};
const idValidationRules = () => {
    return [
        (0, express_validator_1.param)('id')
            .custom(isValidObjectId)
            .withMessage('Invalid ID format. Must be a 24-character hexadecimal string.')
    ];
};
exports.idValidationRules = idValidationRules;
const validateProject = [
    (0, express_validator_1.body)('title').isString().notEmpty().withMessage('Title is required'),
    (0, express_validator_1.body)('description').isString().notEmpty().withMessage('Description is required'),
    (0, express_validator_1.body)('startDate').isISO8601().toDate().withMessage('Invalid start date'),
    (0, express_validator_1.body)('endDate').isISO8601().toDate().withMessage('Invalid end date'),
    (0, express_validator_1.body)('materials').isArray().withMessage('Materials should be an array'),
];
exports.validateProject = validateProject;
exports.verifyRazorpayTransactionValidation = [
    (0, express_validator_1.body)('userId').notEmpty().withMessage('User ID is required'),
    (0, express_validator_1.body)('transactionId').notEmpty().withMessage('Transaction ID is required'),
    (0, express_validator_1.body)('razorpayOrderId').notEmpty().withMessage('Razorpay Order ID is required'),
];
exports.createRazorPayOrderValidation = [
    (0, express_validator_1.body)('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    (0, express_validator_1.body)('userId').notEmpty().withMessage('User ID is required'),
];
