"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchStats = void 0;
const stats_1 = require("../../services/admin/stats");
const logger_1 = __importDefault(require("../../logger"));
const fetchStats = async (req, res) => {
    try {
        const stats = await (0, stats_1.getStats)();
        logger_1.default.info('Stats fetched successfully');
        res.status(200).json(stats);
    }
    catch (error) {
        logger_1.default.error(`Error in stats endpoint: ${error.message}`);
        res.status(500).json({ message: 'An error occurred while fetching stats.' });
    }
};
exports.fetchStats = fetchStats;
