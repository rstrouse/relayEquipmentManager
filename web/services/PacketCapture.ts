import * as fs from 'fs';
import * as path from 'path';
import { config } from "../../config/Config";
import { logger } from "../../logger/Logger";

// Global type declaration for packet capture configuration
declare global {
    var packetCaptureConfig: {
        savedLogConfig?: {
            level: string;
            logToFile: boolean;
            enabled: boolean;
        };
        currentLogFile?: string;
        isActive?: boolean;
        startTime?: Date;
    };
}

export class PacketCaptureService {
    private static instance: PacketCaptureService;
    private logsDir: string;

    private constructor() {
        this.logsDir = path.join(process.cwd(), '/logs');
        this.ensureLogsDirectory();
    }

    public static getInstance(): PacketCaptureService {
        if (!PacketCaptureService.instance) {
            PacketCaptureService.instance = new PacketCaptureService();
        }
        return PacketCaptureService.instance;
    }

    private ensureLogsDirectory(): void {
        if (!fs.existsSync(this.logsDir)) {
            try {
                fs.mkdirSync(this.logsDir, { recursive: true });
                logger.info(`Created logs directory: ${this.logsDir}`);
            } catch (error) {
                logger.error(`Failed to create logs directory: ${error.message}`);
                throw new Error(`Failed to create logs directory: ${error.message}`);
            }
        }
    }

    public async startPacketCapture(): Promise<{ success: boolean; message: string; logFile?: string; error?: string }> {
        try {
            // Check if packet capture is already active
            if (global.packetCaptureConfig?.isActive) {
                return {
                    success: false,
                    message: 'Packet capture is already active',
                    error: 'ALREADY_ACTIVE'
                };
            }

            // Save current logging configuration
            const currentLogConfig = config.getSection('log');
            const savedConfig = {
                level: currentLogConfig.app.level,
                logToFile: currentLogConfig.app.logToFile,
                enabled: currentLogConfig.app.enabled
            };

            // Initialize global configuration
            if (!global.packetCaptureConfig) {
                global.packetCaptureConfig = {};
            }
            global.packetCaptureConfig.savedLogConfig = savedConfig;

            // Set logging to "silly" level and enable file logging
            const packetCaptureLogConfig = {
                app: {
                    enabled: true,
                    level: 'silly',
                    logToFile: true
                }
            };

            // Apply the new logging configuration
            logger.setOptions(packetCaptureLogConfig.app);

            // Create packet capture log file with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const packetCaptureLogFile = `packetCapture_${timestamp}.log`;
            const logFilePath = path.join(this.logsDir, packetCaptureLogFile);

            // Store the log file path and start time for later retrieval
            global.packetCaptureConfig.currentLogFile = logFilePath;
            global.packetCaptureConfig.isActive = true;
            global.packetCaptureConfig.startTime = new Date();

            logger.info(`Packet capture started. Log file: ${packetCaptureLogFile}`);
            logger.silly(`Packet capture logging enabled with maximum verbosity`);
            logger.silly(`Packet capture session started at: ${global.packetCaptureConfig.startTime.toISOString()}`);

            return {
                success: true,
                message: 'Packet capture started successfully',
                logFile: packetCaptureLogFile
            };

        } catch (error) {
            logger.error(`Failed to start packet capture: ${error.message}`);
            return {
                success: false,
                message: 'Failed to start packet capture',
                error: error.message
            };
        }
    }

    public async stopPacketCapture(): Promise<{ success: boolean; message: string; logFile?: string; error?: string }> {
        try {
            if (!global.packetCaptureConfig?.isActive) {
                return {
                    success: false,
                    message: 'Packet capture is not currently active',
                    error: 'NOT_ACTIVE'
                };
            }

            const logFile = path.basename(global.packetCaptureConfig.currentLogFile || '');
            const endTime = new Date();
            const duration = global.packetCaptureConfig.startTime 
                ? Math.round((endTime.getTime() - global.packetCaptureConfig.startTime.getTime()) / 1000)
                : 0;

            // Stop packet capture
            global.packetCaptureConfig.isActive = false;

            // Log the end of packet capture
            logger.info(`Packet capture stopped. Duration: ${duration} seconds`);
            logger.silly(`Packet capture session ended at: ${endTime.toISOString()}`);

            // Restore the previously saved logging configuration
            if (global.packetCaptureConfig.savedLogConfig) {
                const restoredConfig = {
                    app: global.packetCaptureConfig.savedLogConfig
                };
                logger.setOptions(restoredConfig.app);
                logger.info('Packet capture stopped. Logging configuration restored.');
            }

            return {
                success: true,
                message: 'Packet capture stopped successfully',
                logFile: logFile
            };

        } catch (error) {
            logger.error(`Failed to stop packet capture: ${error.message}`);
            return {
                success: false,
                message: 'Failed to stop packet capture',
                error: error.message
            };
        }
    }

    public async getPacketCaptureLog(): Promise<{ success: boolean; logContent?: string; logFile?: string; isActive?: boolean; error?: string; message?: string }> {
        try {
            if (!global.packetCaptureConfig?.currentLogFile) {
                return {
                    success: false,
                    error: 'NO_LOG_FILE',
                    message: 'No packet capture log file found'
                };
            }

            const logFilePath = global.packetCaptureConfig.currentLogFile;
            
            // Check if the log file exists
            if (!fs.existsSync(logFilePath)) {
                return {
                    success: false,
                    error: 'FILE_NOT_FOUND',
                    message: 'Packet capture log file not found'
                };
            }

            // Read the log file content
            const logContent = fs.readFileSync(logFilePath, 'utf8');
            
            return {
                success: true,
                logContent: logContent,
                logFile: path.basename(logFilePath),
                isActive: global.packetCaptureConfig.isActive || false
            };

        } catch (error) {
            logger.error(`Failed to read packet capture log: ${error.message}`);
            return {
                success: false,
                error: error.message,
                message: 'Failed to read packet capture log'
            };
        }
    }

    public getPacketCaptureStatus(): { isActive: boolean; logFile?: string; startTime?: Date } {
        return {
            isActive: global.packetCaptureConfig?.isActive || false,
            logFile: global.packetCaptureConfig?.currentLogFile ? path.basename(global.packetCaptureConfig.currentLogFile) : undefined,
            startTime: global.packetCaptureConfig?.startTime
        };
    }

    public cleanupOldLogFiles(maxAgeHours: number = 24): void {
        try {
            const files = fs.readdirSync(this.logsDir);
            const now = new Date();
            const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

            files.forEach(file => {
                if (file.startsWith('packetCapture_') && file.endsWith('.log')) {
                    const filePath = path.join(this.logsDir, file);
                    const stats = fs.statSync(filePath);
                    const ageMs = now.getTime() - stats.mtime.getTime();

                    if (ageMs > maxAgeMs) {
                        try {
                            fs.unlinkSync(filePath);
                            logger.info(`Cleaned up old packet capture log file: ${file}`);
                        } catch (error) {
                            logger.warn(`Failed to delete old log file ${file}: ${error.message}`);
                        }
                    }
                }
            });
        } catch (error) {
            logger.error(`Failed to cleanup old log files: ${error.message}`);
        }
    }
} 