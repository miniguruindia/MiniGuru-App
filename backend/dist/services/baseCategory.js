"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../logger"));
const error_1 = require("../utils/error");
class BaseService {
    constructor(model) {
        this.model = model;
    }
    async create(data) {
        try {
            logger_1.default.info('Creating new record');
            const newRecord = await this.model.create({ data });
            logger_1.default.info('Record created successfully');
            return newRecord;
        }
        catch (error) {
            logger_1.default.error(`Error creating record: ${error.message}`);
            throw new error_1.ServiceError('Unable to create record');
        }
    }
    async getById(id) {
        try {
            logger_1.default.info(`Fetching record by ID: ${id}`);
            const record = await this.model.findUnique({ where: { id } });
            if (!record) {
                logger_1.default.warn(`Record not found: ${id}`);
                throw new error_1.NotFoundError('Record not found');
            }
            return record;
        }
        catch (error) {
            logger_1.default.error(`Error fetching record by ID: ${error.message}`);
            if (error instanceof error_1.NotFoundError) {
                throw error;
            }
            throw new error_1.ServiceError('Unable to fetch record by ID');
        }
    }
    async getAll() {
        try {
            logger_1.default.info('Fetching all records');
            const records = await this.model.findMany();
            logger_1.default.info(`Fetched ${records.length} records`);
            return records;
        }
        catch (error) {
            logger_1.default.error(`Error fetching records: ${error.message}`);
            throw new error_1.ServiceError('Unable to fetch records');
        }
    }
    async update(id, data) {
        try {
            logger_1.default.info(`Updating record with ID: ${id}`);
            const updatedRecord = await this.model.update({
                where: { id },
                data,
            });
            logger_1.default.info(`Record updated successfully: ${updatedRecord.id}`);
            return updatedRecord;
        }
        catch (error) {
            logger_1.default.error(`Error updating record: ${error.message}`);
            if (error.message.includes('Record not found')) {
                throw new error_1.NotFoundError('Record not found');
            }
            throw new error_1.ServiceError('Unable to update record');
        }
    }
    async delete(id) {
        try {
            logger_1.default.info(`Deleting record with ID: ${id}`);
            const record = await this.model.findUnique({ where: { id } });
            if (!record) {
                logger_1.default.warn(`Record not found for deletion: ${id}`);
                throw new error_1.NotFoundError('Record not found');
            }
            await this.model.delete({ where: { id } });
            logger_1.default.info(`Record deleted successfully: ${id}`);
        }
        catch (error) {
            logger_1.default.error(`Error deleting record: ${error.message}`);
            if (error instanceof error_1.NotFoundError) {
                throw error;
            }
            throw new error_1.ServiceError('Unable to delete record');
        }
    }
}
exports.default = BaseService;
