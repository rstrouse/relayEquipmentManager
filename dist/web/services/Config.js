"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Constants_1 = require("../../boards/Constants");
const Controller_1 = require("../../boards/Controller");
const Pinouts_1 = require("../../pinouts/Pinouts");
const node_ssdp_1 = require("node-ssdp");
const Bindings_1 = require("../../connections/Bindings");
class ConfigRoute {
    static initRoutes(app) {
        app.get('/config/options/general', (req, res) => {
            let opts = {
                controllerTypes: Constants_1.vMaps.controllerTypes.toArray(),
                controller: Controller_1.cont.getExtended()
            };
            return res.status(200).send(opts);
        });
        app.get('/config/options/gpio', (req, res) => {
            let opts = {
                controllerTypes: Constants_1.vMaps.controllerTypes.toArray(),
                pinDirections: Constants_1.vMaps.pinDirections.toArray(),
                pinTypes: Constants_1.vMaps.pinTypes.toArray(),
                controller: Controller_1.cont.getExtended(),
                pinDefinitions: Pinouts_1.PinDefinitions.loadDefintionByName(Controller_1.cont.controllerType.name)
            };
            return res.status(200).send(opts);
        });
        app.get('/config/options/pin/:headerId/:pinId', (req, res) => {
            let opts = {
                pinDirections: Constants_1.vMaps.pinDirections.toArray(),
                pinTypes: Constants_1.vMaps.pinTypes.toArray(),
                triggerStates: Constants_1.vMaps.triggerStates.toArray(),
                pin: Controller_1.cont.gpio.pins.getPinById(parseInt(req.params.headerId, 10), parseInt(req.params.pinId, 10)).getExtended()
            };
            return res.status(200).send(opts);
        });
        app.get('/config/options/trigger/:headerId/:pinId/:triggerId', (req, res) => {
            let pin = Controller_1.cont.gpio.pins.getPinById(parseInt(req.params.headerId, 10), parseInt(req.params.pinId, 10));
            let trigger = pin.triggers.getItemById(parseInt(req.params.triggerId, 10));
            let opts = {
                pinDirections: Constants_1.vMaps.pinDirections.toArray(),
                pinTypes: Constants_1.vMaps.pinTypes.toArray(),
                triggerStates: Constants_1.vMaps.triggerStates.toArray(),
                pin: pin.getExtended(),
                trigger: trigger.getExtended(),
                connections: Controller_1.cont.connections.toExtendedArray()
            };
            return res.status(200).send(opts);
        });
        app.get('/config/options/connections/:connectionId', (req, res) => {
            let connection = (typeof req.params.connectionId !== 'undefined') ? Controller_1.cont.connections.getItemById(parseInt(req.params.connectionId, 10)).getExtended() : undefined;
            let opts = {
                connection: connection,
                connectionTypes: Constants_1.vMaps.connectionTypes.toArray(),
                connections: Controller_1.cont.connections.toExtendedArray()
            };
            return res.status(200).send(opts);
        });
        app.delete('/config/options/connections/:connectionId', async (req, res, next) => {
            try {
                let conn = await Controller_1.cont.deleteConnectionAsync(parseInt(req.params.connectionId, 10));
                return res.status(200).send(conn.getExtended());
            }
            catch (err) {
                next(err);
            }
        });
        app.get('/config/options/connections', (req, res) => {
            let opts = {
                connectionTypes: Constants_1.vMaps.connectionTypes.toArray(),
                connections: Controller_1.cont.connections.toExtendedArray()
            };
            return res.status(200).send(opts);
        });
        app.put('/config/general', async (req, res, next) => {
            try {
                await Controller_1.cont.setGeneralConfigAsync(req.body);
                return res.status(200).send(Controller_1.cont.getExtended());
            }
            catch (err) {
                next(err);
            }
        });
        app.put('/config/connection', async (req, res, next) => {
            try {
                console.log(req.body);
                let conn = await Controller_1.cont.setConnectionAsync(req.body);
                return res.status(200).send(conn.getExtended());
            }
            catch (err) {
                next(err);
            }
        });
        app.put('/config/pin/:headerId/:pinId', async (req, res, next) => {
            try {
                var headerId = parseInt(req.params.headerId, 10);
                var pinId = parseInt(req.params.pinId, 10);
                if (isNaN(headerId))
                    throw new Error(`Invalid Header Id ${req.params.headerId}`);
                if (isNaN(pinId))
                    throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                let pin = await Controller_1.cont.setPinAsync(headerId, pinId, req.body);
                return res.status(200).send(pin.getExtended());
            }
            catch (err) {
                next(err);
            }
        });
        app.put('/config/pin/trigger/:headerId/:pinId', async (req, res, next) => {
            try {
                var headerId = parseInt(req.params.headerId, 10);
                var pinId = parseInt(req.params.pinId, 10);
                if (isNaN(headerId))
                    throw new Error(`Invalid Header Id ${req.params.headerId}`);
                if (isNaN(pinId))
                    throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                let trig = await Controller_1.cont.setPinTriggerAsync(headerId, pinId, req.body);
                return res.status(200).send(trig.getExtended());
            }
            catch (err) {
                next(err);
            }
        });
        app.delete('/config/pin/trigger/:headerId/:pinId/:triggerId', async (req, res, next) => {
            try {
                var headerId = parseInt(req.params.headerId, 10);
                var pinId = parseInt(req.params.pinId, 10);
                var triggerId = parseInt(req.params.triggerId, 10);
                if (isNaN(headerId))
                    throw new Error(`Invalid Header Id ${req.params.headerId}`);
                if (isNaN(pinId))
                    throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                if (isNaN(triggerId))
                    throw new Error(`Invalid Pin Id ${req.params.pinId}`);
                let pin = await Controller_1.cont.deletePinTriggerAsync(headerId, pinId, triggerId);
                return res.status(200).send(pin.getExtended());
            }
            catch (err) {
                next(err);
            }
        });
        app.search('/config/findServer', async (req, res, next) => {
            let prom = new Promise((resolve, reject) => {
                let ssdpClient = new node_ssdp_1.Client({});
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
                catch (err) {
                    reject(err);
                }
                ;
            });
        });
        app.search('/config/connection/bindings', (req, res) => {
            let bindings = Bindings_1.ConnectionBindings.loadBindingsByConnectionType(req.body.name);
            return res.status(200).send(bindings);
        });
        app.put('/config/reset', async (req, res, next) => {
            try {
                await Controller_1.cont.reset();
                res.status(200).send(Controller_1.cont.getExtended());
            }
            catch (err) {
                next(err);
            }
        });
    }
}
exports.ConfigRoute = ConfigRoute;
//# sourceMappingURL=Config.js.map