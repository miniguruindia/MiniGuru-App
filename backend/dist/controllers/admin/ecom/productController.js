"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProduct = exports.updateProduct = exports.getProductById = exports.getProducts = exports.createProduct = void 0;
const product_1 = require("../../../services/admin/product");
const error_1 = require("../../../utils/error"); // Utility function to handle PrismaKnownErrors
const upload_1 = require("../../../middleware/upload");
// Create Product Controller
const createProduct = async (req, res) => {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN')
        return res.status(403).json({ error: 'Forbidden' });
    const { name, description, brand, size, howToUse, price, inventory, categoryName } = req.body;
    const formattedPrice = parseFloat(price);
    const formattedInventory = parseInt(inventory, 10);
    try {
        const images = await (0, upload_1.uploadImages)(req.files); // Process image uploads
        const product = await (0, product_1.createProductService)({ name, description, brand, size, howToUse, price: formattedPrice, inventory: formattedInventory, categoryName, images });
        res.status(201).json(product);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createProduct = createProduct;
// Get All Products Controller
const getProducts = async (_req, res, next) => {
    try {
        const products = await (0, product_1.getProductsService)();
        return res.status(200).json(products);
    }
    catch (error) {
        const handledError = (0, error_1.handlePrismaError)(error);
        return next(handledError);
    }
};
exports.getProducts = getProducts;
// Get Product by ID Controller
const getProductById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const product = await (0, product_1.getProductByIdService)(id);
        return res.status(200).json(product);
    }
    catch (error) {
        const handledError = (0, error_1.handlePrismaError)(error);
        return next(handledError);
    }
};
exports.getProductById = getProductById;
// Update Product Controller
const updateProduct = async (req, res) => {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN')
        return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;
    const { name, description, brand, size, howToUse, price, inventory, categoryName } = req.body;
    let formattedPrice;
    let formattedInventory;
    if (price) {
        formattedPrice = parseFloat(price);
    }
    if (inventory) {
        formattedInventory = parseInt(inventory, 10);
    }
    try {
        const images = await (0, upload_1.uploadImages)(req.files); // Process image uploads
        const product = await (0, product_1.updateProductService)(id, { name, description, brand, size, howToUse, price: formattedPrice, inventory: formattedInventory, categoryName, images });
        res.status(200).json(product);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateProduct = updateProduct;
// Delete Product Controller
const deleteProduct = async (req, res, next) => {
    const { id } = req.params;
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN')
        return res.status(403).json({ error: 'Forbidden' });
    try {
        await (0, product_1.deleteProductService)(id);
        return res.status(204).end();
    }
    catch (error) {
        const handledError = (0, error_1.handlePrismaError)(error);
        return next(handledError);
    }
};
exports.deleteProduct = deleteProduct;
