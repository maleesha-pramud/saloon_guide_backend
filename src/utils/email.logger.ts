import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';

/**
 * Logger class for email-related operations
 */
export class EmailLogger {
    private logDir: string;

    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.ensureLogDirectoryExists();
    }

    /**
     * Ensure the log directory exists
     */
    private ensureLogDirectoryExists(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Log email errors to file
     * @param message Log message
     * @param error Error object
     */
    public logError(message: string, error: any): void {
        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        const logEntry = `${timestamp} [ERROR]: ${message}\n${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}\n\n`;

        const logFile = path.join(this.logDir, `email-errors-${format(new Date(), 'yyyy-MM-dd')}.log`);

        fs.appendFile(logFile, logEntry, (err) => {
            if (err) {
                console.error('Failed to write to email error log:', err);
            }
        });

        // Also log to console
        console.error(`${timestamp} [EMAIL ERROR]: ${message}`, error);
    }

    /**
     * Log email successes to file
     * @param message Log message
     */
    public logSuccess(message: string): void {
        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        const logEntry = `${timestamp} [SUCCESS]: ${message}\n`;

        const logFile = path.join(this.logDir, `email-success-${format(new Date(), 'yyyy-MM-dd')}.log`);

        fs.appendFile(logFile, logEntry, (err) => {
            if (err) {
                console.error('Failed to write to email success log:', err);
            }
        });

        // Also log to console
        console.log(`${timestamp} [EMAIL SUCCESS]: ${message}`);
    }
}

export const emailLogger = new EmailLogger();
