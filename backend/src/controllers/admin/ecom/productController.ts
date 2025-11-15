import { Request, Response, NextFunction } from 'express';
import {
    createProductService,
    updateProductService,
    deleteProductService,
    getProductsService,
    getProductByIdService
} from '../../../services/admin/product';
import { handlePrismaError } from '../../../utils/error'; // Utility function to handle PrismaKnownErrors
import { uploadImages } from '../../../middleware/upload';

// Create Product Controller
export const createProduct = async (req: Request, res: Response) => {
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });

    const { name, description, price, inventory, categoryName } = req.body;
    const formattedPrice = parseFloat(price);
    const formattedInventory = parseInt(inventory, 10);

    try {
        const images = await uploadImages(req.files as Express.Multer.File[]); // Process image uploads
        const product = await createProductService({ name, description, price:formattedPrice, inventory:formattedInventory, categoryName, images });
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

// Get All Products Controller
export const getProducts = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const products = await getProductsService();
        return res.status(200).json(products);
    } catch (error) {
        const handledError = handlePrismaError(error);
        return next(handledError);
    }
};

// Get Product by ID Controller
export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    try {
        const product = await getProductByIdService(id);
        return res.status(200).json(product);
    } catch (error) {
        const handledError = handlePrismaError(error);
        return next(handledError);
    }
};

// Update Product Controller
export const updateProduct = async (req: Request, res: Response) => {
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const { name, description, price, inventory, categoryName } = req.body;
    let formattedPrice:number|undefined;
    let formattedInventory:number|undefined;
    if(price){
        formattedPrice = parseFloat(price);
    }
    if(inventory){
        formattedInventory = parseInt(inventory, 10);

    }
    try {
        const images = await uploadImages(req.files as Express.Multer.File[]); // Process image uploads
        const product = await updateProductService(id, { name, description, price:formattedPrice, inventory:formattedInventory, categoryName, images });
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

// Delete Product Controller
export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });

    try {
        await deleteProductService(id);
        return res.status(204).end();
    } catch (error) {
        const handledError = handlePrismaError(error);
        return next(handledError);
    }
};
