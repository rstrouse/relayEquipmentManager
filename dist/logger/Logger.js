"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const winston = require("winston");
const Config_1 = require("../config/Config");
const extend = require("extend");
class Logger {
    constructor() {
        this.transports = {
            console: new winston.transports.Console({ level: 'silly' })
        };
        if (!fs.existsSync(path.join(process.cwd(), '/logs')))
            fs.mkdirSync(path.join(process.cwd(), '/logs'));
    }
    getConsoleToFilePath() {
        return 'consoleLog(' + this.getLogTimestamp() + ').log';
    }
    getLogTimestamp(bNew = false) {
        if (!bNew && typeof this.currentTimestamp !== 'undefined') {
            return this.currentTimestamp;
        }
        var ts = new Date();
        function pad(n) { return (n < 10 ? '0' : '') + n; }
        this.currentTimestamp = ts.getFullYear() + '-' + pad(ts.getMonth() + 1) + '-' + pad(ts.getDate()) + '_' + pad(ts.getHours()) + '-' + pad(ts.getMinutes()) + '-' + pad(ts.getSeconds());
        return this.currentTimestamp;
    }
    init() {
        this.cfg = Config_1.config.getSection('log');
        exports.logger._logger = winston.createLogger({
            format: winston.format.combine(winston.format.colorize(), winston.format.splat(), winston.format.simple()),
            transports: [this.transports.console]
        });
        this.transports.console.level = this.cfg.app.level;
    }
    async stopAsync() { }
    get options() { return this.cfg; }
    info(...args) { exports.logger._logger.info.apply(exports.logger._logger, arguments); }
    debug(...args) { exports.logger._logger.debug.apply(exports.logger._logger, arguments); }
    warn(...args) { exports.logger._logger.warn.apply(exports.logger._logger, arguments); }
    verbose(...args) { exports.logger._logger.verbose.apply(exports.logger._logger, arguments); }
    error(...args) { exports.logger._logger.error.apply(exports.logger._logger, arguments); }
    silly(...args) { exports.logger._logger.silly.apply(exports.logger._logger, arguments); }
    setOptions(opts, c) {
        c = typeof c === 'undefined' ? this.cfg : c;
        for (let prop in opts) {
            let o = opts[prop];
            if (o instanceof Array) {
                //console.log({ o: o, c: c, prop: prop });
                c[prop] = o; // Stop here we are replacing the array.
            }
            else if (typeof o === 'object') {
                if (typeof c[prop] === 'undefined')
                    c[prop] = {};
                this.setOptions(o, c[prop]); // Use recursion here.  Harder to follow but much less code.
            }
            else
                c[prop] = opts[prop];
        }
        Config_1.config.setSection('log', this.cfg);
        for (let [key, transport] of Object.entries(this.transports)) {
            transport.level = this.cfg.app.level;
        }
    }
}
exports.logger = new Logger();
//# sourceMappingURL=Logger.js.map