import { logger } from "./logger/Logger";
import { config } from "./config/Config";
import { cont } from "./boards/Controller";
import { webApp } from "./web/Server";
import { connBroker } from "./connections/Bindings";
import * as readline from 'readline';
import { gpioCont } from "./gpio/Gpio-Controller";
import { spi0, spi1 } from "./spi-adc/SpiAdcBus";
import { i2c } from "./i2c-bus/I2cBus";
import { gdc } from "./generic/genericDevices";
import { setTimeout } from "timers";
import { oneWire } from "./one-wire/OneWireBus";
require("source-map-support/register")

export function initAsync() {
    return Promise.resolve()
        .then(function () { config.init(); })
        .then(function () { logger.init(); })
        .then(function () { cont.init(); })
        .then(function () { webApp.init(); })
        .then(function () { connBroker.init(); })
        .then(function () { return gpioCont.init(); })
        .then(function () { spi0.initAsync(cont.spi0); })
        .then(function () { spi1.initAsync(cont.spi1); })
        .then(function () { i2c.initAsync(cont.i2c); })
        .then(function () { oneWire.initAsync(cont.oneWire)})
        .then(function () { gdc.initAsync(cont.genericDevices); });
}
export async function stopAsync(): Promise<void> {
    try {
        console.log(`Shutting down Relay Equipment Manager`);
        try { await connBroker.stopAsync(); } catch (err) { console.error(`Error stopping Connection Broker: ${err.message}`); }
        try { await gdc.closeAsync(); } catch (err) { console.error(`Error stopping generic device controller: ${err.message}`); }
        try { await oneWire.closeAsync(); } catch (err) { console.error(`Error stopping 1-wire bus interface: ${err.message}`); }
        try { await i2c.closeAsync(); } catch (err) { console.error(`Error stopping I2c bus interface: ${err.message}`); }
        try { await spi0.closeAsync(); } catch (err) { console.error(`Error stopping SPI0 bus interface: ${err.message}`); }
        try { await spi1.closeAsync(); } catch (err) { console.error(`Error stopping SPI1 bus interface: ${err.message}`); }
        try { await gpioCont.stopAsync(); } catch (err) { console.log(`Error stopping GPIO interface: ${err.message}`); }
        try { await cont.stopAsync(); } catch (err) { console.log(`Error closing controller interface: ${err.message}`); }
        try { await logger.stopAsync(); } catch (err) { console.log(`Error closing logger: ${err.message}`); }
        
        //await new Promise((resolve) => { setTimeout(() => { resolve(); }, 3000); });
    } catch (err) { console.error(`Error stopping processes: ${err.message}`); }
    finally { process.exit(); }
}
if (process.platform === 'win32') {
    let rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('SIGINT', async () => { await stopAsync(); });
}
else {
    process.on('SIGINT', async () => { await stopAsync(); });
}
initAsync();