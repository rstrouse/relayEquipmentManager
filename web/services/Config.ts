import * as express from "express";
import * as extend from 'extend';
import { config } from "../../config/Config";
import { logger } from "../../logger/Logger";
import { utils, vMaps } from "../../boards/Constants";
import { cont } from "../../boards/Controller";
import { PinDefinitions } from "../../pinouts/Pinouts";
import { Client } from "node-ssdp";
import { ConnectionBindings } from "../../connections/Bindings";
import { gpioPins } from "../../boards/GpioPins";
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
    }
}