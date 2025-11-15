import logger from '../logger';
import { NotFoundError, ServiceError } from '../utils/error';

export default class BaseService<T> {
    private model;

    constructor(model) {
        this.model = model;
    }

    async create(data: Partial<T>): Promise<T> {
        try {
            logger.info('Creating new record');
            const newRecord = await this.model.create({ data });
            logger.info('Record created successfully');
            return newRecord;
        } catch (error) {
            logger.error(`Error creating record: ${(error as Error).message}`);
            throw new ServiceError('Unable to create record');
        }
    }

    async getById(id: string): Promise<T | null> {
        try {
            logger.info(`Fetching record by ID: ${id}`);
            const record = await this.model.findUnique({ where: { id } });
            if (!record) {
                logger.warn(`Record not found: ${id}`);
                throw new NotFoundError('Record not found');
            }
            return record;
        } catch (error) {
            logger.error(`Error fetching record by ID: ${(error as Error).message}`);
            if (error instanceof NotFoundError) {
                throw error;
            }
            throw new ServiceError('Unable to fetch record by ID');
        }
    }

    async getAll(): Promise<T[]> {
        try {
            logger.info('Fetching all records');
            const records = await this.model.findMany();
            logger.info(`Fetched ${records.length} records`);
            return records;
        } catch (error) {
            logger.error(`Error fetching records: ${(error as Error).message}`);
            throw new ServiceError('Unable to fetch records');
        }
    }

    async update(id: string, data: Partial<T>): Promise<T> {
        try {
            logger.info(`Updating record with ID: ${id}`);
            const updatedRecord = await this.model.update({
                where: { id },
                data,
            });
            logger.info(`Record updated successfully: ${updatedRecord.id}`);
            return updatedRecord;
        } catch (error) {
            logger.error(`Error updating record: ${(error as Error).message}`);
            if ((error as Error).message.includes('Record not found')) {
                throw new NotFoundError('Record not found');
            }
            throw new ServiceError('Unable to update record');
        }
    }

    async delete(id: string): Promise<void> {
        try {
            logger.info(`Deleting record with ID: ${id}`);
            const record = await this.model.findUnique({ where: { id } });
            if (!record) {
                logger.warn(`Record not found for deletion: ${id}`);
                throw new NotFoundError('Record not found');
            }

            await this.model.delete({ where: { id } });
            logger.info(`Record deleted successfully: ${id}`);
        } catch (error) {
            logger.error(`Error deleting record: ${(error as Error).message}`);
            if (error instanceof NotFoundError) {
                throw error;
            }
            throw new ServiceError('Unable to delete record');
        }
    }
}
