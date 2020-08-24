"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("./logger/Logger");
const Config_1 = require("./config/Config");
const Controller_1 = require("./boards/Controller");
const Server_1 = require("./web/Server");
const Bindings_1 = require("./connections/Bindings");
const readline = require("readline");
const GpioPins_1 = require("./boards/GpioPins");
function initAsync() {
    return Promise.resolve()
        .then(function () { Config_1.config.init(); })
        .then(function () { Logger_1.logger.init(); })
        .then(function () { Controller_1.cont.init(); })
        .then(function () { Server_1.webApp.init(); })
        .then(function () { Bindings_1.connBroker.init(); })
        .then(function () { GpioPins_1.gpioPins.init(); });
}
exports.initAsync = initAsync;
function stopAsync() {
    return Promise.resolve()
        .then(function () { console.log('Shutting down open processes'); })
        .then(function () { GpioPins_1.gpioPins.stopAsync(); })
        .then(function () { Bindings_1.connBroker.stopAsync(); })
        .then(function () { Controller_1.cont.stopAsync(); })
        .then(function () { process.exit(); });
}
exports.stopAsync = stopAsync;
if (process.platform === 'win32') {
    let rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('SIGINT', function () { stopAsync(); });
}
else {
    process.on('SIGINT', function () { return stopAsync(); });
}
initAsync();
//# sourceMappingURL=app.js.map