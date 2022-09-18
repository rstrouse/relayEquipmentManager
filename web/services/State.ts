import * as express from "express";
import * as extend from 'extend';
import { config } from "../../config/Config";
import { logger } from "../../logger/Logger";
import { utils, vMaps } from "../../boards/Constants";
import { cont, ConfigItem } from "../../boards/Controller";
import { PinDefinitions } from "../../pinouts/Pinouts";
import { Client } from "node-ssdp";
import { ConnectionBindings } from "../../connections/Bindings";
import { gpioCont } from "../../gpio/Gpio-Controller";
import { SpiAdcChips } from "../../spi-adc/SpiAdcChips";
import { i2c, i2cBus } from "../../i2c-bus/I2cBus";
import { oneWire } from "../../one-wire/OneWireBus";

export class StateRoute {
    public static initRoutes(app: express.Application) {
        app.get('/devices/state', async (req, res, next) => {
            try {
                res.status(200).send(cont.get(true));


            } catch (err) { next(err); }
        });
        app.get('/devices/all', (req, res) => {
            let devs = cont.analogDevices;
            let devices = [];
            for (let i = 0; i < cont.gpio.pins.length; i++) {
                let pin = cont.gpio.pins.getItemByIndex(i);
                devices.push({ type: 'gpio', isActive: pin.isActive, name: pin.name || `GPIO Pin #${pin.headerId}-${pin.id}`, binding: `gpio:${pin.headerId}:${pin.id}`, category:'GPIO Pins', feeds: pin.feeds.get() });
            }
            for (let i = 0; i < cont.spi0.channels.length; i++) {
                let chan = cont.spi0.channels.getItemByIndex(i);
                let dev = devs.find(elem => elem.id === chan.deviceId);
                devices.push({ type: 'spi', isActive: chan.isActive, name: `${typeof dev !== 'undefined' ? dev.name : 'Channel #0-' + chan.id}`, binding: `spi:0:${chan.id}`, category: typeof dev !== 'undefined' ? dev.category : 'Unknown SPI' });
            }
            for (let i = 0; i < cont.spi1.channels.length; i++) {
                let chan = cont.spi1.channels.getItemByIndex(i);
                let dev = devs.find(elem => elem.id === chan.deviceId);
                devices.push({ type: 'spi', isActive: chan.isActive, name: `${typeof dev !== 'undefined' ? dev.name : 'Channel #1-' + chan.id}`, binding: `spi:1:${chan.id}`, category: typeof dev !== 'undefined' ? dev.category : 'Unknown SPI', feeds: dev.feeds.get() });
            }
            for (let i = 0; i < cont.i2c.buses.length; i++) {
                let bus = cont.i2c.buses.getItemByIndex(i);
                let i2cbus = i2c.buses.find(elem => elem.busId === bus.id);
                for (let j = 0; j < bus.devices.length; j++) {
                    let device = bus.devices.getItemByIndex(j);
                    let dev = devs.find(elem => elem.id === device.typeId);
                    let i2cdevice = typeof i2cbus !== 'undefined' ? i2cbus.devices.find(elem => elem.device.id === device.id) : undefined;
                    if (typeof i2cdevice !== 'undefined') devices.push(...i2cdevice.getDeviceDescriptions(dev));
                    else devices.push({ type: 'i2c', isActive: device.isActive, name: device.name, binding: `i2c:${bus.id}:${device.id}`, category: typeof dev !== 'undefined' ? dev.category : 'unknown', feeds: device.feeds.get()  });
                }
            }
            for (let i = 0; i < cont.oneWire.buses.length; i++) {
                let bus = cont.oneWire.buses.getItemByIndex(i);
                let oneWirebus = oneWire.buses.find(elem => elem.busId === bus.id);
                for (let j = 0; j < bus.devices.length; j++) {
                    let device = bus.devices.getItemByIndex(j);
                    let dev = devs.find(elem => elem.id === device.typeId);
                    let oneWiredevice = typeof oneWirebus !== 'undefined' ? oneWirebus.devices.find(elem => elem.device.id === device.id) : undefined;
                    if (typeof oneWiredevice !== 'undefined') devices.push(...oneWiredevice.getDeviceDescriptions(dev));
                    else devices.push({ type: 'oneWire', isActive: device.isActive, name: device.name, binding: `oneWire:${bus.id}:${device.id}`, category: typeof dev !== 'undefined' ? dev.category : 'unknown', feeds: device.feeds.get()  });
                }
            }
            for (let i = 0; i < cont.genericDevices.devices.length; i++) {
                let genericDevice = cont.genericDevices.devices.getItemByIndex(i);
                let deviceType = devs.find(elem => elem.id === genericDevice.typeId);
                devices.push({ type: 'generic', isActive: genericDevice.isActive, name: typeof genericDevice.options.name !== 'undefined' ? genericDevice.options.name : deviceType.name, binding: `generic:${genericDevice.typeId}:${genericDevice.id}`, category: typeof deviceType !== 'undefined' ? deviceType.category : 'Unknown Generic Device', feeds: genericDevice.feeds.get() });
            }
            return res.status(200).send(devices);
        });
        app.put('/state/device/:binding', async (req, res, next) => {
            try {
                //console.log(`setDeviceState: ${req.params.binding} - ${JSON.stringify(req.body)}`);
                let ret = await cont.setDeviceState(req.params.binding, req.body);
                return res.status(200).send(ret);
            }
            catch (err) { next(err); }
        });
        app.get('/state/device/:binding', async (req, res, next) => {
            try {
                let ret = await cont.getDeviceState(req.params.binding);
                return res.status(200).send(typeof ret==='number'?ret.toString():ret);
            }
            catch (err) { next(err); }
        });
        app.get('/status/device/:binding', async (req, res, next) => {
            try {
                let ret = await cont.getDeviceStatus(req.params.binding);
                return res.status(200).send(ret);
            }
            catch (err) { next(err); }
        });
        app.put('/feed/device/:binding', async (req, res, next) => {
            try {
                //console.log(`feed: ${req.params.binding}: ${JSON.stringify(req.body)}`);
                let ret = await cont.feedDeviceValue(req.params.binding, req.body);
                return res.status(200).send(ret);
            }
            catch (err) { next(err); }
        });
    }
}