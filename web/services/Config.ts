import * as express from "express";
import * as extend from 'extend';
import * as dns from 'dns';
import { config } from "../../config/Config";
import { logger } from "../../logger/Logger";
import { utils, vMaps } from "../../boards/Constants";
import { cont, ConfigItem } from "../../boards/Controller";
import { PinDefinitions } from "../../pinouts/Pinouts";
import { Client } from "node-ssdp";
import { connBroker, ConnectionBindings } from "../../connections/Bindings";
import { gpioCont } from "../../gpio/Gpio-Controller";
import { SpiAdcChips } from "../../spi-adc/SpiAdcChips";
export class ConfigRoute {
    // GPIO Config services.
    public static initGPIO(app: express.Application) {
        app.get('/config/backup/controller', (req, res) => {
            return res.status(200).send(cont.get(true));
        });
        app.put('/config/restore/validate', async (req, res, next) => {
            try {
                let ctx = await cont.validateRestore(req.body);
                return res.status(200).send(ctx);
            } catch (err) { next(err); }
        });
        app.put('/config/restore/file', async (req, res, next) => {
            try {
                await cont.restore(req.body);
            } catch (err) { next(err); }

        });
        app.get('/config/options/gpio/pin/feeds/:headerId/:pinId', (req, res) => {
            let pin = cont.gpio.pins.getPinById(parseInt(req.params.headerId, 10), parseInt(req.params.pinId, 10));
            let opts = {
                pin: pin.getExtended(),
                feeds: pin.feeds.toExtendedArray(),
                connections: cont.connections.toExtendedArray()
            }
            opts.connections.unshift(cont.getInternalConnection().getExtended());
            return res.status(200).send(opts);
        });
        app.put('/config/gpio/pin/feed', async (req, res, next) => {
            try {
                let feeds = await cont.gpio.setDeviceFeed(req.body);
                return res.status(200).send(feeds.toExtendedArray());
            }
            catch (err) { next(err); }
        })
        app.delete('/config/gpio/pin/feed', async (req, res, next) => {
            try {
                let feeds = await cont.gpio.deleteDeviceFeed(req.body);
                return res.status(200).send(feeds.toExtendedArray());
            }
            catch (err) { next(err); }
        });

        app.get('/config/options/gpio/pin/:headerId/:pinId', (req, res) => {
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
        app.put('/config/gpio/pin/:headerId/:pinId', async (req, res, next) => {
            try {
                var headerId = parseInt(req.params.headerId, 10);
                var pinId = parseInt(req.params.pinId, 10);
                if (isNaN(headerId)) throw new Error(`Invalid Header Id ${req.params.headerId}`);
                if (isNaN(pinId)) throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                let pin = await cont.gpio.setPinAsync(headerId, pinId, req.body);
                return res.status(200).send(pin.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/gpio/pin/trigger/:headerId/:pinId', async (req, res, next) => {
            try {
                let headerId = parseInt(req.params.headerId, 10);
                let pinId = parseInt(req.params.pinId, 10);
                if (isNaN(headerId)) throw new Error(`Invalid Header Id ${req.params.headerId}`);
                if (isNaN(pinId)) throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                let trig = await cont.gpio.setPinTriggerAsync(headerId, pinId, req.body);
                return res.status(200).send(trig.getExtended());
            }
            catch (err) { next(err); }
        });
        app.delete('/config/gpio/pin/trigger/:headerId/:pinId/:triggerId', async (req, res, next) => {
            try {
                var headerId = parseInt(req.params.headerId, 10);
                var pinId = parseInt(req.params.pinId, 10);
                var triggerId = parseInt(req.params.triggerId, 10);
                if (isNaN(headerId)) throw new Error(`Invalid Header Id ${req.params.headerId}`);
                if (isNaN(pinId)) throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                if (isNaN(triggerId)) throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                let pin = await cont.gpio.deletePinTriggerAsync(headerId, pinId, triggerId);
                return res.status(200).send(pin.getExtended());
            }
            catch (err) { next(err); }
        });
        app.get('/config/options/gpio', (req, res) => {
            let pinouts = cont.pinouts;
            let states = gpioCont.pinStates;
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
    }
    public static initRoutes(app: express.Application) {
        ConfigRoute.initGPIO(app);
        app.get('/config/options/general', (req, res) => {
            let opts = {
                controllerTypes: vMaps.controllerTypes.toArray(),
                controller: cont.getExtended(),
                logger: config.getSection('log')
            };
            return res.status(200).send(opts);
        });

        //
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
        app.get('/config/options/i2c/:busNumber/:deviceAddress/trigger/:triggerId', (req, res) => {
            let bus = cont.i2c.buses.getItemByBusNumber(parseInt(req.params.busNumber, 10));
            let device = bus.devices.getItemByAddress(parseInt(req.params.deviceAddress, 10));
            let trigger = device.triggers.getItemById(parseInt(req.params.triggerId, 10));
            let opts = {
                bus: bus.getExtended(),
                device: device.getExtended(),
                trigger: trigger.getExtended(),
                connections: cont.connections.toExtendedArray()
            };
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

        app.get('/config/options/i2c/:busNumber', (req, res) => {
            let opts = { bus: cont.i2c.buses.getItemByBusNumber(parseInt(req.params.busNumber, 10)).getExtended() };
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
        app.put('/config/i2c/device/changeAddress', async (req, res, next) => {
            try {
                let dev = await cont.i2c.changeAddress(req.body);
                return res.status(200).send(dev.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/i2c/scanBus', async (req, res, next) => {
            try {
                let busNumber = parseInt(req.body.busNumber, 10);
                if (isNaN(busNumber)) next(new Error(`Cannot scan bus because the bus number ${req.body.busNumber} is invalid.`));
                else {
                    let bus = cont.i2c.buses.find(elem => elem.busNumber === busNumber);
                    if (typeof bus === 'undefined') next(new Error(`Cannot scan bus because the bus ${req.body.busNumber} cannot be found.`));
                    else {
                        await bus.scanBus();
                        let opts = { bus: bus.getExtended() };
                        return res.status(200).send(opts);
                    }
                }
            } catch(err) { next(err); }
        });
        app.put('/config/i2c/addAddress', async (req, res, next) => {
            try {
                let busNumber = parseInt(req.body.busNumber, 10);
                if (isNaN(busNumber)) next(new Error(`Cannot add address because the bus number ${req.body.busNumber} is invalid.`));
                else {
                    let bus = cont.i2c.buses.find(elem => elem.busNumber === busNumber);
                    if (typeof bus === 'undefined') next(new Error(`Cannot scan bus because the bus ${req.body.busNumber} cannot be found.`));
                    else {
                        await bus.addAddress(req.body);
                        let opts = { bus: bus.getExtended() };
                        return res.status(200).send(opts);
                    }
                }
            } catch (err) { next(err); }
        });

        app.put('/config/i2c/device/reset', async (req, res, next) => {
            try {
                let dev = await cont.i2c.resetDevice(req.body);
                return res.status(200).send(dev.getExtended());
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
        });
        app.put('/config/i2c/device/trigger', async (req, res, next) => {
            try {
                let trigs = await cont.i2c.setDeviceTrigger(req.body);
                return res.status(200).send(trigs.toExtendedArray());
            }
            catch (err) { next(err); }
        });
        app.delete('/config/i2c/device/trigger', async (req, res, next) => {
            try {
                let trigs = await cont.i2c.deleteDeviceTrigger(req.body);
                return res.status(200).send(trigs.toExtendedArray());
            }
            catch (err) { next(err); }
        });

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
        app.put('/config/i2c/:busNumber/:deviceId/saveRelay', async (req, res, next) => {
            try {
                let dev = cont.i2c.getDeviceById(parseInt(req.params.busNumber, 10), parseInt(req.params.deviceId, 10));


            } catch (err) { next(err); }
        });
        app.put('/config/i2c/:busNumber/:deviceAddress/deviceCommand/:command', async (req, res, next) => {
            try {
                let result = await cont.i2c.runDeviceCommand(parseInt(req.params.busNumber, 10), parseInt(req.params.deviceAddress, 10), req.params.command, req.body);
                if (result instanceof ConfigItem) return res.status(200).send((result as ConfigItem).getExtended());
                return res.status(200).send(result);
            }
            catch (err) { next(err); }
        });

        // BEGIN 1-WIRE END POINTS


        app.get('/config/options/oneWire/:busNumber/:deviceAddress/feeds', (req, res) => {
            // Get a listing of all the devices that we can feed internally.  These are destinations
            // that don't need to go anywhere outside.  This is our internal connection.
            let bus = cont.oneWire.buses.getItemByBusNumber(parseInt(req.params.busNumber, 10));
            let dev = bus.devices.getItemByAddress(req.params.deviceAddress);
            let opts = {
                connections: cont.connections.toExtendedArray(),
                device: dev.getExtended()
            }
            opts.connections.unshift(cont.getInternalConnection().getExtended());
            return res.status(200).send(opts);
        });
        app.get('/config/options/oneWire/:busNumber/:deviceAddress/trigger/:triggerId', (req, res) => {
            let bus = cont.oneWire.buses.getItemByBusNumber(parseInt(req.params.busNumber, 10));
            let device = bus.devices.getItemByAddress(req.params.deviceAddress);
            let trigger = device.triggers.getItemById(parseInt(req.params.triggerId, 10));
            let opts = {
                bus: bus.getExtended(),
                device: device.getExtended(),
                trigger: trigger.getExtended(),
                connections: cont.connections.toExtendedArray()
            };
            return res.status(200).send(opts);
        });
        app.get('/config/options/oneWire/:busNumber/:deviceAddress', (req, res) => {
            let bus = cont.oneWire.buses.getItemByBusNumber(parseInt(req.params.busNumber, 10));
            let device = bus.devices.getItemByAddress(req.params.deviceAddress);
            let opts = {
                bus: bus.getExtended(),
                device: device.getExtended(),
                deviceTypes: cont.analogDevices.filter(elem => typeof elem.interfaces === 'undefined' || elem.interfaces.indexOf('oneWire') !== -1)
            };
            return res.status(200).send(opts);
        });

        app.get('/config/options/oneWire/:busNumber', (req, res) => {
            let opts = { bus: cont.oneWire.buses.getItemByBusNumber(parseInt(req.params.busNumber, 10)).getExtended() };
            return res.status(200).send(opts);
        });
        app.get('/config/options/oneWire', (req, res) => {
            let opts = {
                buses: cont.oneWire.buses.toExtendedArray()
            }
            return res.status(200).send(opts);
        });
        app.put('/config/oneWire/bus', async (req, res, next) => {
            try {
                let bus = await cont.setOneWireBusAsync(req.body);
                return res.status(200).send(bus.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/oneWire/device/changeAddress', async (req, res, next) => {
            try {
                let dev = await cont.oneWire.changeAddress(req.body);
                return res.status(200).send(dev.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/oneWire/scanBus', async (req, res, next) => {
            try {
                let busId = parseInt(req.body.busNumber, 10);
                if (isNaN(busId)) next(new Error(`Cannot scan bus because the bus number ${req.body.busNumber} is invalid.`));
                else {
                    let bus = cont.oneWire.buses.find(elem => elem.id === busId);
                    if (typeof bus === 'undefined') next(new Error(`Cannot scan bus because the bus ${req.body.busNumber} cannot be found.`));
                    else {
                        await bus.scanBus();
                        let opts = { bus: bus.getExtended() };
                        return res.status(200).send(opts);
                    }
                }
            } catch(err) { next(err); }
        });
        app.put('/config/oneWire/addAddress', async (req, res, next) => {
            try {
                let busId = parseInt(req.body.busNumber, 10);
                if (isNaN(busId)) next(new Error(`Cannot add address because the bus number ${req.body.busNumber} is invalid.`));
                else {
                    let bus = cont.oneWire.buses.find(elem => elem.id === busId);
                    if (typeof bus === 'undefined') next(new Error(`Cannot scan bus because the bus ${req.body.busNumber} cannot be found.`));
                    else {
                        await bus.addAddress(req.body);
                        let opts = { bus: bus.getExtended() };
                        return res.status(200).send(opts);
                    }
                }
            } catch (err) { next(err); }
        });

        app.put('/config/oneWire/device/reset', async (req, res, next) => {
            try {
                let dev = await cont.oneWire.resetDevice(req.body);
                return res.status(200).send(dev.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/oneWire/device', async (req, res, next) => {
            try {
                let dev = await cont.oneWire.setDevice(req.body);
                return res.status(200).send(dev.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/oneWire/device/feed', async (req, res, next) => {
            try {
                let feeds = await cont.oneWire.setDeviceFeed(req.body);
                return res.status(200).send(feeds.toExtendedArray());
            }
            catch (err) { next(err); }
        });
        app.delete('/config/oneWire/device/feed', async (req, res, next) => {
            try {
                let feeds = await cont.oneWire.deleteDeviceFeed(req.body);
                return res.status(200).send(feeds.toExtendedArray());
            }
            catch (err) { next(err); }
        });
        app.put('/config/oneWire/device/trigger', async (req, res, next) => {
            try {
                let trigs = await cont.oneWire.setDeviceTrigger(req.body);
                return res.status(200).send(trigs.toExtendedArray());
            }
            catch (err) { next(err); }
        });
        app.delete('/config/oneWire/device/trigger', async (req, res, next) => {
            try {
                let trigs = await cont.oneWire.deleteDeviceTrigger(req.body);
                return res.status(200).send(trigs.toExtendedArray());
            }
            catch (err) { next(err); }
        });

        app.delete('/config/oneWire/bus', async (req, res, next) => {
            try {
                await cont.oneWire.deleteBus(req.body);
                return res.status(200).send({ buses: cont.oneWire.buses.toExtendedArray() });
            }
            catch (err) { next(err); }
        });
        app.delete('/config/oneWire/device', async (req, res, next) => {
            try {
                let dev = await cont.oneWire.deleteDevice(req.body);
                return res.status(200).send(dev.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/oneWire/:busNumber/:deviceAddress/deviceCommand/:command', async (req, res, next) => {
            try {
                let result = await cont.oneWire.runDeviceCommand(parseInt(req.params.busNumber, 10), req.params.deviceAddress, req.params.command, req.body);
                if (result instanceof ConfigItem) return res.status(200).send((result as ConfigItem).getExtended());
                return res.status(200).send(result);
            }
            catch (err) { next(err); }
        });
        // END 1-WIRE END POINTS

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
            catch (err) { next(err); }
        });
        app.delete('/config/options/spi/chipType/:id', (req, res, next) => {
            try {
                let chip = SpiAdcChips.deleteCustomDefintion(parseInt(req.params.id, 10));
                let opts = { chipType: chip, adcChipTypes: cont.spiAdcChips };
                return res.status(200).send(opts);
            }
            catch (err) { next(err); }
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
                let conn = await cont.setConnectionAsync(req.body);
                return res.status(200).send(conn.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/checkconnection', async (req, res, next) => {
            try {
                let conn = await cont.checkConnectionAsync(req.body);
                return res.status(200).send(conn.getExtended()).destroy();
            }
            catch (err) { next(err); }
        });
        app.put('/config/checkemit', (req, res, next) => {
            try {
                let server = connBroker.findServer(parseInt(req.body.connectionId, 10));
                if (typeof server !== 'undefined') {
                    server.send(req.body);
                    logger.info(`checkEmit: id ${server.connectionId}`);
                }
                else {
                    console.log(`checkEmit: Invalid connection id ${req.body.connectionId}`);
                    return res.status(400).send('Server not found');
                }
                return res.status(200).send('Ok');
            }
            catch (err) { next(err); }
        });
        app.search('/config/findServer', async (req, res, next) => {
            let prom = new Promise<void>((resolve, reject) => {
                let ssdpClient = new Client({});
                let servers = [];
                try {
                    ssdpClient.on('response', (headers, statusCode, rinfo) => {
                        if (statusCode === 200) {
                            let url = new URL(headers.LOCATION);
                            if (typeof servers.find(elem => url.origin === elem.origin) === 'undefined') {
                                let server = { origin: url.origin, username: url.username, password: url.password, protocol: url.protocol, host: url.host, hostname: url.hostname, port: url.port, hash: url.hash, hostnames: [] };
                                servers.push(server);
                                (async () => {
                                    try {
                                        server.hostnames = await dns.promises.reverse(url.hostname);
                                    } catch (err) { logger.error(`Error resolving host names: ${err.message}`) }
                                })();
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
        app.put('/config/feed', async (req, res, next) => {
            try {
                await cont.setDeviceFeed(req.body);
                res.status(200).send(cont.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/config/verifyFeed', async (req, res, next) => {
            try {
                await cont.verifyDeviceFeed(req.body);
                res.status(200).send(cont.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/state/setPinState', async (req, res, next) => {
            try {
                let pin = await cont.gpio.setPinStateAsync(parseInt(req.body.headerId, 10), parseInt(req.body.gpioId, 10), req.body);
                return res.status(200).send(pin.getExtended());
            }
            catch (err) { next(err); }
        });
        app.put('/state/jogPin', async (req, res, next) => {
            try {
                let pin = await cont.gpio.jogPinAsync(req.body.headerId, req.body.pinId || 1, req.body);
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
        app.get('/config/options/genericDevices/', (req, res) => {
            // let bus = cont.i2c.buses.getItemByBusNumber(parseInt(req.params.busNumber, 10));
            let device = cont.genericDevices;  // bus.devices.getItemByAddress(parseInt(req.params.deviceAddress, 10));
            let opts = {
                // bus: bus.getExtended(),
                genericDevices: device.getExtended(),
                deviceTypes: cont.analogDevices.filter(elem => typeof elem.interfaces === 'undefined' || elem.interfaces.indexOf('generic') !== -1)
            };
            return res.status(200).send(opts);
        });
        app.get('/config/options/generic/:id/feeds', (req, res) => {
            // let bus = cont.i2c.buses.getItemByBusNumber(parseInt(req.params.busNumber, 10));
            let dev = cont.genericDevices.devices.getItemById(parseInt(req.params.id, 10));
            let opts = {
                connections: cont.connections.toExtendedArray(),
                device: dev.getExtended()
            }
            opts.connections.unshift(cont.getInternalConnection().getExtended());
            return res.status(200).send(opts);
        });
        app.put('/config/generic/device/feed', async (req, res, next) => {
            try {
                let feeds = await cont.genericDevices.setDeviceFeed(req.body);
                return res.status(200).send(feeds.toExtendedArray());
            }
            catch (err) { next(err); }
        });
        app.delete('/config/generic/device/feed', async (req, res, next) => {
            try {
                let feeds = await cont.genericDevices.deleteDeviceFeed(req.body);
                return res.status(200).send(feeds.toExtendedArray());
            }
            catch (err) { next(err); }
        });
        app.put('/config/genericDevices/device', async (req, res, next) => {
            try {
                let dev = await cont.genericDevices.setDevice(req.body);
                return res.status(200).send(dev.getExtended());
            }
            catch (err) { next(err); }
        });
        app.delete('/config/genericDevices/device', async (req, res, next) => {
            try {
                let dev = await cont.genericDevices.deleteDevice(req.body);
                let device = cont.genericDevices;  // bus.devices.getItemByAddress(parseInt(req.params.deviceAddress, 10));
                let opts = {
                    // bus: bus.getExtended(),
                    genericDevices: device.getExtended(),
                    deviceTypes: cont.analogDevices.filter(elem => typeof elem.interfaces === 'undefined' || elem.interfaces.indexOf('generic') !== -1)
                };
                return res.status(200).send(opts);
            }
            catch (err) { next(err); }
        });
        app.get('/app/options/logger', (req, res) => {
            let opts = {
                logger: config.getSection('log')
            }
            return res.status(200).send(opts);
        });
        app.put('/app/logger/setOptions', (req, res) => {
            logger.setOptions(req.body);
            return res.status(200).send(logger.options);
        });
    }
}