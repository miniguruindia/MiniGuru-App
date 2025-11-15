import { body , param , check } from 'express-validator';

const registerValidationRules = () => {
    return [
        body('email').isEmail().withMessage('Invalid email address'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
        body('name').notEmpty().withMessage('Name is required'),
        body('age').isInt({ min: 0 }).withMessage('Age must be a positive number'),
        // body('role').isIn(['user', 'admin']).withMessage('Role must be either user or admin'),
    ];
};

const updateUserValidationRules = [
    check('email').optional().isEmail().withMessage('Invalid email format'),
    check('name').optional().isLength({ min: 3 }).withMessage('Name must be at least 3 characters long'),
    check('age').optional().isInt({ min: 1 }).withMessage('Age must be a positive integer'),
];

const productValidationRules = () => {
    return [
        body('name').notEmpty().withMessage('Name is required'),
        body('description').notEmpty().withMessage('Description is required'),
        body('price').isFloat({ gt: 0 }).withMessage('Price must be a positive number'),
        body('inventory').isInt({ gt: 0 }).withMessage('Inventory must be a positive integer'),
        body('categoryName').notEmpty().withMessage('Category is required'),
        // body('images').isArray().withMessage('Images must be an array of URLs'),
    ];
};

const orderValidationRules = () => {
    return [
        body('products').isArray().withMessage('Products must be an array'),
        body('products.*.id').notEmpty().withMessage('Product ID is required'),
        body('products.*.quantity').isInt({ gt: 0 }).withMessage('Quantity must be a positive integer'),
    ];
};

// const idValidationRules = () => {
//     return [
//         param('id').isUUID().withMessage('Invalid ID format'),
//     ];
// };
const isValidObjectId = (value: string): boolean => {
    const objectIdRegex = /^[a-fA-F0-9]{24}$/;
    return objectIdRegex.test(value);
};
const idValidationRules = () => {
    return [
        param('id')
            .custom(isValidObjectId)
            .withMessage('Invalid ID format. Must be a 24-character hexadecimal string.')
    ];
};

const validateProject = [
    body('title').isString().notEmpty().withMessage('Title is required'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('startDate').isISO8601().toDate().withMessage('Invalid start date'),
    body('endDate').isISO8601().toDate().withMessage('Invalid end date'),
    body('materials').isArray().withMessage('Materials should be an array'),
];

export const verifyRazorpayTransactionValidation = [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('transactionId').notEmpty().withMessage('Transaction ID is required'),
    body('razorpayOrderId').notEmpty().withMessage('Razorpay Order ID is required'),
];

export const createRazorPayOrderValidation = [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('userId').notEmpty().withMessage('User ID is required'),
];

export { registerValidationRules,productValidationRules, orderValidationRules, idValidationRules, updateUserValidationRules, validateProject };
