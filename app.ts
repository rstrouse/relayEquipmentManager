import { logger } from "./logger/Logger";
import { config } from "./config/Config";
import { cont } from "./boards/Controller";
import { webApp } from "./web/Server";
import { connBroker } from "./connections/Bindings";
import * as readline from 'readline';
import { gpioPins } from "./boards/GpioPins";
import { spi0, spi1 } from "./spi-adc/SpiAdcBus";

export function initAsync() {
    return Promise.resolve()
        .then(function () { config.init(); })
        .then(function () { logger.init(); })
        .then(function () { cont.init(); })
        .then(function () { webApp.init(); })
        .then(function () { connBroker.init(); })
        .then(function () { gpioPins.init(); })
        .then(function () { spi0.initAsync(cont.spi0); })
        .then(function () { spi1.initAsync(cont.spi1); });
}
export function stopAsync(): Promise<void> {
    return Promise.resolve()
        .then(function () { console.log('Shutting down open processes'); })
        .then(function () { spi0.closeAsync(); })
        .then(function () { spi1.closeAsync(); })
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