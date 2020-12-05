import * as express from "express";
import * as extend from 'extend';
import { config } from "../../config/Config";
import { logger } from "../../logger/Logger";
import { utils, vMaps } from "../../boards/Constants";
import { cont, ConfigItem } from "../../boards/Controller";
import { PinDefinitions } from "../../pinouts/Pinouts";
import { Client } from "node-ssdp";
import { ConnectionBindings } from "../../connections/Bindings";
import { gpioPins } from "../../boards/GpioPins";
import { SpiAdcChips } from "../../spi-adc/SpiAdcChips";
export class ConfigRoute {
    public static initRoutes(app: express.Application) {
        app.get('/config/options/general', (req, res) => {
            let opts = {
                controllerTypes: vMaps.controllerTypes.toArray(),
                controller: cont.getExtended()
            };
            return res.status(200).send(opts);
        });
        app.get('/config/options/gpio', (req, res) => {
            let pinouts = cont.pinouts;
            let states = gpioPins.pinStates;
            for (let i = 0; i < states.length; i++) {
                let state = states[i];
                let header = pinouts.headers.find(elem => elem.id === state.headerId);
                if (typeof header !== 'undefined') {
                    let pinout = header.pins.find(elem => elem.id === state.pinId);
                    if (typeof pinout !== 'undefined') pinout.state = state.state;
                }
            }
            // Map the 
            let opts = {
                controllerTypes: vMaps.controllerTypes.toArray(),
                pinDirections: vMaps.pinDirections.toArray(),
                pinTypes: vMaps.pinTypes.toArray(),
                controller: cont.getExtended(),
                pinDefinitions: pinouts,
                pinStates: states
            };
            return res.status(200).send(opts);
        });
        app.get('/config/options/spi/:controllerId', (req, res) => {
            let opts = {
                adcChipTypes: cont.spiAdcChips,
                analogDevices: cont.analogDevices.filter(elem => typeof elem.interfaces === 'undefined' || elem.interfaces.indexOf('spi') !== -1),
                spi: cont['spi' + req.params.controllerId].getExtended()
            };
            return res.status(200).send(opts);
        });
        app.get('/config/options/spi/:controllerId/:channelId/feeds', (req, res) => {
            let opts = {
                connections: cont.connections.toExtendedArray()
            }
            opts.connections.unshift(cont.getInternalConnection().getExtended());
            return res.status(200).send(opts);
        });
        app.get('/config/options/i2c/:busNumber/:deviceAddress/feeds', (req, res) => {
            // Get a listing of all the devices that we can feed internally.  These are destinations
            // that don't need to go anywhere outside.  This is our internal connection.
            let bus = cont.i2c.buses.getItemByBusNumber(parseInt(req.params.busNumber, 10));
            let dev = bus.devices.getItemByAddress(parseInt(req.params.deviceAddress, 10));
            let opts = {
                connections: cont.connections.toExtendedArray(),
                device: dev.getExtended()
            }
            opts.connections.unshift(cont.getInternalConnection().getExtended());
            return res.status(200).send(opts);
        });
        app.get('/config/options/i2c/:busNumber/:deviceAddress', (req, res) => {
            let bus = cont.i2c.buses.getItemByBusNumber(parseInt(req.params.busNumber, 10));
            let device = bus.devices.getItemByAddress(parseInt(req.params.deviceAddress, 10));
            let opts = {
                bus: bus.getExtended(),
                device: device.getExtended(),
                deviceTypes: cont.analogDevices.filter(elem => typeof elem.interfaces === 'undefined' || elem.interfaces.indexOf('i2c') !== -1)
            };
            return res.status(200).send(opts);
        });
        app.get('/config/options/i2c/:busId', (req, res) => {
            let opts = { bus: cont.i2c.buses.getItemById(parseInt(req.params.busId, 10)).getExtended() };
            return res.status(200).send(opts);
        });
        app.get('/config/options/i2c', (req, res) => {
            let opts = {
                buses: cont.i2c.buses.toExtendedArray()
            }
            return res.status(200).send(opts);
        });
        app.put('/config/i2c/bus', async (req, res, next) => {
            try {
                let bus = await cont.setI2cBusAsync(req.body);
                return res.status(200).send(bus.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/i2c/device', async (req, res, next) => {
            try {
                let dev = await cont.i2c.setDevice(req.body);
                return res.status(200).send(dev.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/i2c/device/feed', async (req, res, next) => {
            try {
                let feeds = await cont.i2c.setDeviceFeed(req.body);
                return res.status(200).send(feeds.toExtendedArray());
            }
            catch (err) { next(err); }
        });
        app.delete('/config/i2c/device/feed', async (req, res, next) => {
            try {
                let feeds = await cont.i2c.deleteDeviceFeed(req.body);
                return res.status(200).send(feeds.toExtendedArray());
            }
            catch (err) { next(err); }
        })

        app.delete('/config/i2c/bus', async (req, res, next) => {
            try {
                await cont.i2c.deleteBus(req.body);
                return res.status(200).send({ buses: cont.i2c.buses.toExtendedArray() });
            }
            catch (err) { next(err); }
        });
        app.delete('/config/i2c/device', async (req, res, next) => {
            try {
                let dev = await cont.i2c.deleteDevice(req.body);
                return res.status(200).send(dev.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/i2c/:busNumber/:deviceAddress/deviceCommand/:command', async (req, res, next) => {
            try {
                let result = await cont.i2c.runDeviceCommand(parseInt(req.params.busNumber, 10), parseInt(req.params.deviceAddress, 10), req.params.command, req.body);
                if (result instanceof ConfigItem) return res.status(200).send((result as ConfigItem).getExtended());
                return res.status(200).send(result);
            }
            catch (err) { next(err); }
        });


        app.put('/config/spi/:controllerId', async (req, res, next) => {
            try {
                let spi = await cont.setSpiControllerAsync(parseInt(req.params.controllerId, 10), req.body);
                return res.status(200).send(spi.getExtended());
            }
            catch (err) { next(err); }
        });

        app.put('/config/options/spi/chipType', (req, res, next) => {
            try {
                let chip = SpiAdcChips.saveCustomDefinition(req.body);
                let opts = { chipType: chip, adcChipTypes: cont.spiAdcChips };
                return res.status(200).send(opts);
            }
            catch(err) { next(err); }
        });
        app.delete('/config/options/spi/chipType/:id', (req, res, next) => {
            try {
                let chip = SpiAdcChips.deleteCustomDefintion(parseInt(req.params.id, 10));
                let opts = { chipType: chip, adcChipTypes: cont.spiAdcChips };
                return res.status(200).send(opts);
            }
            catch (err) { next(err); }
        });
        app.get('/config/options/pin/:headerId/:pinId', (req, res) => {
            let opts = {
                pinDirections: vMaps.pinDirections.toArray(),
                pinTypes: vMaps.pinTypes.toArray(),
                triggerStates: vMaps.triggerStates.toArray(),
                pin: cont.gpio.pins.getPinById(parseInt(req.params.headerId, 10), parseInt(req.params.pinId, 10)).getExtended()
            }
            return res.status(200).send(opts);
        });
        app.get('/config/options/trigger/:headerId/:pinId/:triggerId', (req, res) => {
            let pin = cont.gpio.pins.getPinById(parseInt(req.params.headerId, 10), parseInt(req.params.pinId, 10));
            let trigger = pin.triggers.getItemById(parseInt(req.params.triggerId, 10));
            let opts = {
                pinDirections: vMaps.pinDirections.toArray(),
                pinTypes: vMaps.pinTypes.toArray(),
                triggerStates: vMaps.triggerStates.toArray(),
                pin: pin.getExtended(),
                trigger: trigger.getExtended(),
                connections: cont.connections.toExtendedArray()
            };
            return res.status(200).send(opts);
        });
        app.get('/config/options/connections/:connectionId', (req, res) => {
            let connection = (typeof req.params.connectionId !== 'undefined') ? cont.connections.getItemById(parseInt(req.params.connectionId, 10)).getExtended() : undefined;
            let opts = {
                connection: connection,
                connectionTypes: vMaps.connectionTypes.toArray(),
                connections: cont.connections.toExtendedArray()
            };
            return res.status(200).send(opts);
        });
        app.delete('/config/options/connections/:connectionId', async (req, res, next) => {
            try {
                let conn = await cont.deleteConnectionAsync(parseInt(req.params.connectionId, 10));
                return res.status(200).send(conn.getExtended());
            }
            catch (err) { next(err); }
        });
        app.get('/config/options/connections', (req, res) => {
            let opts = {
                connectionTypes: vMaps.connectionTypes.toArray(),
                connections: cont.connections.toExtendedArray()
            };
            return res.status(200).send(opts);
        });
        app.put('/config/general', async (req, res, next) => {
            try {
                await cont.setGeneralConfigAsync(req.body);
                return res.status(200).send(cont.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/connection', async (req, res, next) => {
            try {
                console.log(req.body);
                let conn = await cont.setConnectionAsync(req.body);
                return res.status(200).send(conn.getExtended());
            }
            catch (err) { next(err); }

        });
        app.put('/config/pin/:headerId/:pinId', async (req, res, next) => {
            try {
                var headerId = parseInt(req.params.headerId, 10);
                var pinId = parseInt(req.params.pinId, 10);
                if (isNaN(headerId)) throw new Error(`Invalid Header Id ${req.params.headerId}`);
                if (isNaN(pinId)) throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                let pin = await cont.setPinAsync(headerId, pinId, req.body);
                return res.status(200).send(pin.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/pin/trigger/:headerId/:pinId', async (req, res, next) => {
            try {
                let headerId = parseInt(req.params.headerId, 10);
                let pinId = parseInt(req.params.pinId, 10);
                if (isNaN(headerId)) throw new Error(`Invalid Header Id ${req.params.headerId}`);
                if (isNaN(pinId)) throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                let trig = await cont.setPinTriggerAsync(headerId, pinId, req.body);
                return res.status(200).send(trig.getExtended());
            }
            catch (err) { next(err); }
        });
        app.delete('/config/pin/trigger/:headerId/:pinId/:triggerId', async (req, res, next) => {
            try {
                var headerId = parseInt(req.params.headerId, 10);
                var pinId = parseInt(req.params.pinId, 10);
                var triggerId = parseInt(req.params.triggerId, 10);
                if (isNaN(headerId)) throw new Error(`Invalid Header Id ${req.params.headerId}`);
                if (isNaN(pinId)) throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                if (isNaN(triggerId)) throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                let pin = await cont.deletePinTriggerAsync(headerId, pinId, triggerId);
                return res.status(200).send(pin.getExtended());
            }
            catch (err) { next(err); }
        });
        app.search('/config/findServer', async (req, res, next) => {
            let prom = new Promise((resolve, reject) => {
                let ssdpClient = new Client({});
                let servers = [];
                try {
                    ssdpClient.on('response', (headers, statusCode, rinfo) => {
                        if (statusCode === 200) {
                            let url = new URL(headers.LOCATION);
                            if (typeof servers.find(elem => url.origin === elem.origin) === 'undefined') {
                                servers.push({ origin: url.origin, username: url.username, password: url.password, protocol: url.protocol, host: url.host, hostname: url.hostname, port: url.port, hash: url.hash });
                            }
                        }
                    });
                    ssdpClient.search(req.body.urn);
                    setTimeout(() => {
                        resolve();
                        ssdpClient.stop();
                        return res.status(200).send(servers);
                    }, 5000);
                }
                catch (err) { reject(err); };
            });
        });
        app.search('/config/connection/bindings', (req, res) => {
            let bindings = ConnectionBindings.loadBindingsByConnectionType(req.body.name);
            return res.status(200).send(bindings);
        });
        app.put('/config/reset', async (req, res, next) => {
            try {
                await cont.reset();
                res.status(200).send(cont.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/state/setPinState', async (req, res, next) => {
            try {
                let pin = await cont.setPinStateAsync(req.body);
                return res.status(200).send(pin.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/state/jogPin', async (req, res, next) => {
            try {
                let pin = cont.gpio.pins.getPinById(req.body.headerId, req.body.pinId || 1);
                if (!pin.isActive) {
                    logger.error(`GPIO Pin #${req.body.headerId} ${req.body.pinId} is not active.`);
                    return next(new Error(`GPIO Pin #${req.body.headerId} ${req.body.pinId} is not active.`));
                }
                let currentState = utils.makeBool(pin.state.gpio);
                let state = req.body.state !== 'undefined' ? utils.makeBool(req.body.state) : pin.state.gpio === 'on' ? true : false;
                let times = req.body.times || 1;
                if (currentState === state) {
                    await cont.setPinStateAsync({ pinId: pin.id, headerId: pin.headerId, state: !state });
                    await new Promise((resolve, reject) => setTimeout(() => { resolve(); }, req.body.delay || 100));
                }
                while (times > 0) {
                    await cont.setPinStateAsync({ pinId: pin.id, headerId: pin.headerId, state: state });
                    await new Promise((resolve, reject) => setTimeout(() => { resolve(); }, req.body.delay || 100));
                    if(times > 1) await cont.setPinStateAsync({ pinId: pin.id, headerId: pin.headerId, state: !state });
                    times--;
                }
                return res.status(200).send(pin.getExtended());
            }
            catch (err) { next(err); }
        });
        app.get('/config/device/:binding', async (req, res, next) => {
            try {
                let dev = await cont.getDevice(req.params.binding);
                return res.status(200).send(dev.get(true));
            }
            catch (err) { next(err); }
        });
    }
}