import { logger } from "./logger/Logger";
import { config } from "./config/Config";
import { cont } from "./boards/Controller";
import { webApp } from "./web/Server";
import { connBroker } from "./connections/Bindings";
import * as readline from 'readline';
import { gpioPins } from "./boards/GpioPins";

export function initAsync() {
    return Promise.resolve()
        .then(function () { config.init(); })
        .then(function () { logger.init(); })
        .then(function () { cont.init(); })
        .then(function () { webApp.init(); })
        .then(function () { connBroker.init(); })
        .then(function () { gpioPins.init(); });
}
export function stopAsync(): Promise<void> {
    return Promise.resolve()
        .then(function () { console.log('Shutting down open processes'); })
        .then(function () { gpioPins.stopAsync(); })
        .then(function () { connBroker.stopAsync(); })
        .then(function () { cont.stopAsync(); })
        .then(function () { process.exit(); });
}
if (process.platform === 'win32') {
    let rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('SIGINT', function () { stopAsync(); });
}
else {
    process.on('SIGINT', function () { return stopAsync(); });
}
initAsync();