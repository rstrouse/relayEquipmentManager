import * as path from 'path';
import * as fs from 'fs';
import * as winston from 'winston';
import * as os from 'os';
import { utils } from "../boards/Constants";
import { config } from '../config/Config';
import { webApp } from '../web/Server';

const extend = require("extend");

class Logger {
    constructor() {
        if (!fs.existsSync(path.join(process.cwd(), '/logs'))) fs.mkdirSync(path.join(process.cwd(), '/logs'));
    }
    private cfg;
    private consoleToFilePath: string;
    private transports: { console: winston.transports.ConsoleTransportInstance, file?: winston.transports.FileTransportInstance, consoleFile?: winston.transports.FileTransportInstance } = {
        console: new winston.transports.Console({ level: 'silly' })
    };
    private captureForReplayBaseDir: string;
    private captureForReplayPath: string;
    private pktTimer: NodeJS.Timeout;
    private currentTimestamp: string;
    private myFormat = winston.format.printf(({ level, message, label, timestamp }) => {
        return `[${timestamp}] ${level}: ${message}`;
    });
    private getConsoleToFilePath(): string {
        return 'consoleLog(' + this.getLogTimestamp() + ').log';
    }
    public getLogTimestamp(bNew: boolean = false): string {
        if (!bNew && typeof this.currentTimestamp !== 'undefined') { return this.currentTimestamp; }
        var ts = new Date();
        function pad(n) { return (n < 10 ? '0' : '') + n; }
        this.currentTimestamp = ts.getFullYear() + '-' + pad(ts.getMonth() + 1) + '-' + pad(ts.getDate()) + '_' + pad(ts.getHours()) + '-' + pad(ts.getMinutes()) + '-' + pad(ts.getSeconds());
        return this.currentTimestamp;
    }
    private _logger: winston.Logger;
    public init() {
        // match date format used by njsPC
        const timestampFormat = winston.format.timestamp({format: 'DD/MM/YYYY, HH:mm:ss'});
        this.cfg = config.getSection('log');
        if(typeof logger._logger !== 'undefined') logger._logger.close();
        logger._logger = winston.createLogger({
            format: winston.format.combine(winston.format.colorize(), winston.format.splat(), timestampFormat, this.myFormat),
            transports: [this.transports.console]
        });
        this.transports.console.level = this.cfg.app.level;
        if (this.cfg.app.logToFile) {
            this.transports.consoleFile = new winston.transports.File({
                filename: path.join(process.cwd(), '/logs', this.getConsoleToFilePath()),
                level: 'silly',
                format: winston.format.combine(winston.format.splat(), winston.format.uncolorize(), timestampFormat, this.myFormat)
            });
            this.transports.consoleFile.level = this.cfg.app.level;
            this._logger.add(this.transports.consoleFile);
        }

    }
    public async stopAsync() {
        try {
            if (typeof logger._logger !== 'undefined') logger._logger.close();
        } catch (err) { console.log(`Error closing logger: ${err.message}`); }
    }
    public get options(): any { return this.cfg; }
    public info(...args: any[]) { logger._logger.info.apply(logger._logger, arguments); }
    public debug(...args: any[]) { logger._logger.debug.apply(logger._logger, arguments); }
    public warn(...args: any[]) { logger._logger.warn.apply(logger._logger, arguments); }
    public verbose(...args: any[]) { logger._logger.verbose.apply(logger._logger, arguments); }
    public error(...args: any[]) { logger._logger.error.apply(logger._logger, arguments); }
    public silly(...args: any[]) { logger._logger.silly.apply(logger._logger, arguments); }
    public setOptions(opts, c?: any) {
        c = typeof c === 'undefined' ? this.cfg : c;
        for (let prop in opts) {
            let o = opts[prop];
            if (o instanceof Array) {
                //console.log({ o: o, c: c, prop: prop });
                c[prop] = o; // Stop here we are replacing the array.
            }
            else if (typeof o === 'object') {
                if (typeof c[prop] === 'undefined') c[prop] = {};
                this.setOptions(o, c[prop]); // Use recursion here.  Harder to follow but much less code.
            }
            else
                c[prop] = opts[prop];
        }
        config.setSection('log', this.cfg);
        if (utils.makeBool(this.cfg.app.logToFile)) {
            if (typeof this.transports.consoleFile === 'undefined') {
                this.transports.consoleFile = new winston.transports.File({
                    filename: path.join(process.cwd(), '/logs', this.getConsoleToFilePath()),
                    level: 'silly',
                    format: winston.format.combine(winston.format.splat(), winston.format.uncolorize(), this.myFormat)
                });
                this._logger.add(this.transports.consoleFile);
            }
        }
        else {
            if (typeof this.transports.consoleFile !== 'undefined') {
                this._logger.remove(this.transports.consoleFile);
                this.transports.consoleFile.close();
                this.transports.consoleFile = undefined;
            }
        }
        for (let [key, transport] of Object.entries(this.transports)) {
            if (typeof transport !== 'undefined') transport.level = this.cfg.app.level;
        }
    }
    public setLogFile(filename: string) {
        const filePath = path.join(process.cwd(), '/logs', filename);
        if (this.transports.consoleFile) {
            this._logger.remove(this.transports.consoleFile);
            this.transports.consoleFile.close();
        }
        this.transports.consoleFile = new winston.transports.File({
            filename: filePath,
            level: 'silly',
            format: winston.format.combine(winston.format.splat(), winston.format.uncolorize(), this.myFormat)
        });
        this._logger.add(this.transports.consoleFile);
    }
}
export var logger = new Logger();
