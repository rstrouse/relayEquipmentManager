import { connect, MqttClient, Client } from 'mqtt';
import { vMaps } from "../boards/Constants";
import * as path from "path";
import * as fs from "fs";
import { cont, ConnectionSource, DeviceBinding } from "../boards/Controller";
import { logger } from "../logger/Logger";
import { webApp } from "../web/Server";
import { i2c } from "../i2c-bus/I2cBus";
import * as extend from "extend";
const io = require('socket.io-client');
//import io from "socket.io-client";
//import { Server } from "http";
export class ConnectionBindings {
    public static dataTypes = {
        boolean: { operators: ['eq'], values: [{ val: 'true', name: 'True' }, { val: 'false', name: 'False' }] },
        string: { operators: ['eq', 'gt', 'lt', 'gte', 'lte', 'neq'] },
        number: { operators: ['eq', 'gt', 'lt', 'gte', 'lte', 'neq'] }
    }
    public static loadBindingsByConnectionType(name: string) {
        let conn = typeof name === 'string' ? vMaps.connectionTypes.transformByName(name) : name;
        let bindings;
        if (conn.val === -1) {
            bindings = {};
            bindings.devices = cont.getDeviceInputs();
            bindings.dataTypes = this.dataTypes;
            bindings.operatorTypes = vMaps.operators.toArray();
        }
        else {
            let cfgFile = conn.bindings;
            if (typeof cfgFile === 'string') {
                let filePath = path.posix.join(process.cwd(), `/connections/${cfgFile}`);
                bindings = JSON.parse(fs.readFileSync(filePath, 'utf8').trim());
                bindings.dataTypes = this.dataTypes;
                bindings.operatorTypes = vMaps.operators.toArray();
            }
        }
        return bindings || { events: [], operatorTypes: [], feeds:[] };
    }
}
export class ConnectionBroker {
    public listeners: ServerConnection[] = [];
    public compile() {
        this.freeConnections();
        this.init();
    }
    public freeConnections() {
        for (let i = this.listeners.length - 1; i >= 0; i--) {
            this.listeners[i].disconnect();
            this.listeners.splice(i, 1);
        }
    }
    public deleteConnection(id: number) {
        for (let i = this.listeners.length - 1; i >= 0; i--) {
            let listener = this.listeners[i]
            if (typeof listener !== 'undefined' && listener.server.id === id) {
                listener.disconnect();
                this.listeners.splice(i, 1);
            }
        }
    }
    public init() {
        for (let i = 0; i < cont.connections.length; i++) {
            let source = cont.connections.getItemByIndex(i);
            if (!source.isActive) continue;
            switch (source.type.name) {
                case 'njspc':
                case 'webSocket':
                    this.listeners.push(new SocketServerConnection(source));
                    break;
                case 'mqttClient':
                    this.listeners.push(new MqttConnection(source));
                    break;
            }
        }
        this.listeners.push(new InternalConnection(cont.getInternalConnection()));
        for (let i = 0; i < this.listeners.length; i++) {
            this.listeners[i].connect();
        }
    }
    public findServer(connectionId: number): ServerConnection {
        return this.listeners.find(elem => elem.connectionId === connectionId);
    }
    public async stopAsync() {
        this.freeConnections();
        return this;
    }
}
export class ServerConnection {
    public server: ConnectionSource;
    public connectionId: number;
    constructor(server: ConnectionSource) { this.server = server; this.connectionId = server.id; }
    public isOpen = false;
    public disconnect() {
        if (!this.isOpen) return;
    }
    public connect() {
        if (typeof this.server !== 'undefined') this.isOpen = true;
    }
    public send(opts) {}
}
class InternalConnection extends ServerConnection {
    constructor(server: ConnectionSource) { super(server); }
    public async send(opts) {
        try {
            // Take the deviceBinding.
            if (typeof opts.deviceBinding !== 'undefined') {
                let arr = opts.deviceBinding.split(':');
                if (arr[0] === 'i2c') {
                    await i2c.setDeviceValue(parseInt(arr[1], 10), parseInt(arr[2], 10), opts.property, opts.value);
                }
                else if (arr[0] === 'spi') {

                }
                else if (arr[0] === 'gpio') {
                    // await cont.gpio.setDeviceValue(parseInt(arr[1], 10), parseInt(arr[2], 10), opts.property, opts.value);
                    await cont.setDeviceState(opts.deviceBinding, opts.value);
                }
                else if (arr[0] === 'generic'){
                    // generic:typeId:id
                    await cont.genericDevices.setDeviceValue(parseInt(arr[1], 10), parseInt(arr[2], 10), opts.property, opts.value);
                }
            }
        } catch (err) { logger.error(`Error sending on internal connection ${opts.deviceBinding}: ${err.message}`); }
    }
}
class SocketServerConnection extends ServerConnection {
    private _sock;
    constructor(server: ConnectionSource) { super(server); }
    public events = [];
    public disconnect() {
        if (typeof this._sock !== 'undefined') this._sock.removeAllListeners();
        this._sock.disconnect();
        super.disconnect();
    }
    public processEvent(event, data) {
        // Find the event.
        var evt = this.events.find(elem => elem.name === event);
        logger.info(`Processing socket event ${event}`);
        if (typeof evt !== 'undefined') {
            // Go through all the triggers to see if we find one.
            for (let i = 0; i < evt.triggers.length; i++) {
                let trig = evt.triggers[i];
                let device = cont.getDeviceByBinding(trig.binding);
                if (typeof device === 'undefined' || device.isActive === false) continue;
                let trigger = device.triggers.getItemById(trig.triggerId);
                if (typeof trigger === 'undefined' || !trigger.isActive) continue;
                if (trigger.sourceId !== this.server.id) continue;
                let val = typeof trig.filter === 'function' ? trig.filter(this.server.get(true), device.get(true), trigger.get(true), data) : true;
                if (val === true) {
                    if (trig.binding.startsWith('gpio')) (async () => {
                        try {
                            await device.setDeviceState({ state: trigger.state.val });
                        } catch (err) { }
                    })();
                    else (async () => {
                        try {
                            if (typeof trigger.stateExpression !== 'undefined' && trigger.stateExpression.length > 0) {
                                try {
                                    let fnTransform = new Function('connection', 'trigger', 'device', 'data', trigger.stateExpression);
                                    data = fnTransform(this, trigger, device, data);
                                } catch (err) { logger.error(`Trigger for device ${trig.binding} cannot evaluate binding function ${err}`); }
                            }
                            await device.setDeviceState(trig.binding, data);
                        } catch (err) { logger.error(`Error processing Socket event ${event}: ${err}`); }
                    })();
                    //if (trig.binding.startsWith('gpio')) device.setDeviceState({ state: trigger.state.val });
                    //else device.setDeviceState(trig.binding, data);
                }
            }
        }
    }
    public connect() {
        let url = this.server.url;
        this._sock = io(url, { reconnectionDelay: 2000, reconnection: true, reconnectionDelayMax: 20000 });
        this._sock.on('connect_error', (err) => { logger.error(`Error connecting to ${this.server.name} ${url}: ${err}`); });
        this._sock.on('close', (sock) => { logger.info(`Socket ${this.server.name} ${url} closed`); });
        this._sock.on('reconnecting', (sock) => { logger.info(`Reconnecting to ${this.server.name} : ${url}`); });
        this._sock.on('connect', (sock) => {
            logger.info(`Connected to ${this.server.name} : ${url}`);
            // Put a list of events together for the devuces.
            for (let i = 0; i < cont.gpio.pins.length; i++) {
                let pin = cont.gpio.pins.getItemByIndex(i);
                let triggers = pin.triggers.toArray();
                for (let j = 0; j < triggers.length; j++) {
                    let trigger = triggers[j];
                    if (trigger.sourceId !== this.server.id || typeof trigger.eventName === 'undefined' || trigger.eventName === '') continue;
                    let evt = this.events.find(elem => elem.name === trigger.eventName);
                    if (typeof evt === 'undefined') {
                        evt = { name: trigger.eventName, triggers: [] };
                        this.events.push(evt);
                        logger.info(`Binding ${evt.name} from ${this.server.name} to pin ${pin.headerId}-${pin.id}`);
                        this._sock.on(evt.name, (data) => { this.processEvent(evt.name, data); });
                    }
                    try {
                        let fnFilter = trigger.makeTriggerFunction();
                        evt.triggers.push({ filter: fnFilter, binding: `gpio:${pin.headerId}:${pin.id}`, triggerId: trigger.id });
                    }
                    catch (err) { logger.error(`Invalid Pin#${pin.id} trigger Expression: ${err} : ${trigger.makeExpression()}`); }
                }
            }
            for (let k = 0; k < cont.i2c.buses.length; k++) {
                let bus = cont.i2c.buses.getItemByIndex(k);
                for (let i = 0; i < bus.devices.length; i++) {
                    let device = bus.devices.getItemByIndex(i);
                    let triggers = device.triggers.toArray();
                    for (let j = 0; j < triggers.length; j++) {
                        let trigger = triggers[j];
                        if (trigger.sourceId !== this.server.id || typeof trigger.eventName === 'undefined' || trigger.eventName === '') continue;
                        let evt = this.events.find(elem => elem.name === trigger.eventName);
                        if (typeof evt === 'undefined') {
                            evt = { name: trigger.eventName, triggers: [] };
                            this.events.push(evt);
                            logger.info(`Binding ${evt.name} from ${this.server.name} to i2c Device ${bus.busNumber}-${device.address} ${device.name}`);
                            this._sock.on(evt.name, (data) => { this.processEvent(evt.name, data); });
                        }
                        try {
                            let fnFilter = trigger.makeTriggerFunction();
                            evt.triggers.push({
                                binding: `i2c:${bus.busNumber}:${device.id}${typeof trigger.channelId !== 'undefined' ? ':' + trigger.channelId : ''}`,
                                filter: fnFilter, triggerId: trigger.id
                            });
                        }
                        catch (err) { logger.error(`Invalid I2c Device ${device.id} trigger Expression: ${err} : ${trigger.makeExpression()}`); }
                    }
                }
            }
            //let bindings = ConnectionBindings.loadBindingsByConnectionType(this.server.type);
            //// Go through each of the sockets and add them in.
            //for (let i = 0; i < cont.gpio.pins.length; i++) {
            //    let pin = cont.gpio.pins.getItemByIndex(i);
            //    for (let k = 0; k < pin.triggers.length; k++) {
            //        let trigger = pin.triggers.getItemByIndex(k);
            //        if (!trigger.isActive) continue;
            //        if (trigger.sourceId !== this.server.id) continue;
            //        // See if there is a binding for this connection type.
            //        let binding = bindings.events.find(elem => elem.name === trigger.eventName);
            //        if (typeof trigger.eventName !== 'undefined' && trigger.eventName !== '') {
            //            let evt = this.events.find(elem => elem.name === trigger.eventName);
            //            if (typeof evt === 'undefined') {
            //                evt = { name: trigger.eventName, triggers: [] };
            //                this.events.push(evt);
            //                logger.info(`Binding ${evt.name} from ${this.server.name} to pin ${pin.headerId}-${pin.id}`);
            //                this._sock.on(evt.name, (data) => { this.processEvent(evt.name, data); });
            //            }
            //            try {
            //                let fnFilter = trigger.makeTriggerFunction();
            //                evt.triggers.push({ pin: pin, filter: fnFilter, trigger: trigger });
            //            }
            //            catch (err) { logger.error(`Invalid Pin#${pin.id} trigger Expression: ${err} : ${trigger.makeExpression()}`); }
                       
            //        }
            //    }
            //}
        });
    }
    public send(opts) {
        let obj = {};
        obj[opts.property] = opts.value;
        if (typeof opts.options === 'object') obj = extend(true, obj, opts.options);
        logger.verbose(`Emitting: /${opts.eventName} : ${JSON.stringify(obj)}`);
        this._sock.emit('/' + opts.eventName, JSON.stringify(obj));
    }
}
class MqttConnection extends ServerConnection {
    private _mqtt: MqttClient;
    public events = [];
    public subscribed = false;
    constructor(server: ConnectionSource) { super(server); }
    public disconnect() {
        if (typeof this._mqtt !== 'undefined') this._mqtt.removeAllListeners();
        this._mqtt.end(false);
        this.isOpen = false;
        super.disconnect();
    }
    private initSubscribe() {
        // Put a list of events together for the devuces.
        for (let i = 0; i < cont.gpio.pins.length; i++) {
            let pin = cont.gpio.pins.getItemByIndex(i);
            let triggers = pin.triggers.toArray();
            for (let j = 0; j < triggers.length; j++) {
                let trigger = triggers[j];
                if (trigger.sourceId !== this.server.id || typeof trigger.eventName === 'undefined' || trigger.eventName === '') continue;
                let evt = this.events.find(elem => elem.topic === trigger.eventName);
                if (typeof evt === 'undefined') {
                    evt = { topic: trigger.eventName, triggers: [] };
                    this.events.push(evt);
                    this._mqtt.subscribe(evt.topic, (err, granted) => {
                        if (err)
                            logger.error(`Error binding MQTT ${evt.topic} from ${this.server.name} to pin ${pin.headerId}-${pin.id}`);
                        else 
                            logger.info(`Bound MQTT ${evt.topic} from ${this.server.name} to pin ${pin.headerId}-${pin.id}`);
                    });
                }
                try {
                    let fnFilter = trigger.makeTriggerFunction();
                    evt.triggers.push({ filter: fnFilter, binding: `gpio:${pin.headerId}:${pin.id}`, triggerId: trigger.id });
                }
                catch (err) { logger.error(`Invalid Pin#${pin.id} trigger Expression: ${err} : ${trigger.makeExpression()}`); }
            }
        }
        for (let k = 0; k < cont.i2c.buses.length; k++) {
            let bus = cont.i2c.buses.getItemByIndex(k);
            for (let i = 0; i < bus.devices.length; i++) {
                let device = bus.devices.getItemByIndex(i);
                let triggers = device.triggers.toArray();
                for (let j = 0; j < triggers.length; j++) {
                    let trigger = triggers[j];
                    if (trigger.sourceId !== this.server.id || typeof trigger.eventName === 'undefined' || trigger.eventName === '') continue;
                    let evt = this.events.find(elem => elem.topic === trigger.eventName);
                    if (typeof evt === 'undefined') {
                        evt = { topic: trigger.eventName, triggers: [] };
                        this.events.push(evt);
                        this._mqtt.subscribe(evt.topic, (err, granted) => {
                            if (err)
                                logger.error(`Error binding MQTT ${evt.topic} from ${this.server.name} to I2c Device ${bus.busNumber}-${device.address} ${device.name}`);
                            else
                                logger.info(`Bound MQTT ${evt.topic} from ${this.server.name} to I2c Device ${bus.busNumber}-${device.address} ${device.name}`);
                        });
                    }
                    try {
                        let fnFilter = trigger.makeTriggerFunction();
                        evt.triggers.push({
                            binding: `i2c:${bus.busNumber}:${device.id}${typeof trigger.channelId !== 'undefined' ? ':' + trigger.channelId : ''}`,
                            filter: fnFilter, triggerId: trigger.id });
                    }
                    catch (err) { logger.error(`Invalid I2c Device ${device.id} trigger Expression: ${err} : ${trigger.makeExpression()}`); }
                }
            }
        }
        if (this.subscribed) this._mqtt.off('message', this.messageHandler);
        this._mqtt.on('message', this.messageHandler)
        this.subscribed = true;
    }
    private initPublish() {

    }
    private messageHandler = async (topic, message) => {
        let msg = message.toString();
        let evt = this.events.find(elem => elem.topic === topic);
        if (typeof evt !== 'undefined') {
            logger.info(`Processing MQTT topic ${topic}`);
            // Do a little messag pre-processing because MQTT is lame.
            if (msg.startsWith('{')) msg = JSON.parse(msg);
            if (msg === 'true') msg = true;
            else if (msg === 'false') msg = false;
            else if (!isNaN(+msg)) msg = parseFloat(msg);
            
            // Go through all the triggers to see if we find one.
            for (let i = 0; i < evt.triggers.length; i++) {
                let trig = evt.triggers[i];
                let device = cont.getDeviceByBinding(trig.binding);
                if (typeof device === 'undefined' || device.isActive === false) {
                    logger.warn(`Could not process MQTT topic ${topic} could not find device ${trig.binding}`);
                    continue;
                }
                let trigger = device.triggers.getItemById(trig.triggerId);
                if (typeof trigger === 'undefined' || !trigger.isActive) continue;
                if (trigger.sourceId !== this.server.id) continue;
                let val = typeof trig.filter === 'function' ? trig.filter(this.server.get(true), device.get(true), trigger.get(true), msg) : true;
                if (val === true) {
                    if (trig.binding.startsWith('gpio')) (async () => {
                        try {
                            await device.setDeviceState({ state: trigger.state.val });
                        } catch (err) { }
                    })();
                    else (async () => {
                        try {
                            if (typeof trigger.stateExpression !== 'undefined' && trigger.stateExpression.length > 0) {
                                try {
                                    let fnTransform = new Function('connection', 'trigger', 'device', 'data', trigger.stateExpression);
                                    msg = fnTransform(this, trigger, device, msg);
                                } catch (err) { logger.error(`Trigger for device ${trig.binding} cannot evaluate binding function ${err}`); }
                            }
                            await device.setDeviceState(trig.binding, msg);
                        } catch (err) { logger.error(`Error processing MQTT topic ${evt.topic}: ${err}`); }
                    })();
                }
            }
        }
    }
    public connect() {
        let url = this.server.url;
        logger.info(`Connecting mqtt to ${url}`);
        let opts = extend(true, {}, this.server.options);
        if (typeof this.server.userName !== 'undefined' && this.server.userName !== '') opts.username = this.server.userName;
        if (typeof this.server.password !== 'undefined' && this.server.password !== '') opts.password = this.server.password;

        this._mqtt = connect(url, opts);
        this._mqtt.on('connect', () => {
            logger.info(`MQTT Connected to ${url}`);
            this.isOpen = true;
            //this._mqtt.disconnecting = false;
            this.initSubscribe();
            this.initPublish();
        });
    }
    public send(opts) {
        if (typeof this._mqtt === 'undefined' || !this._mqtt) {
            logger.warn(`MQTT Channel disconnected`);
        }
        else if (this._mqtt.disconnected) {
            logger.warn('MQTT Channel disconnected');
        }
        else if (this._mqtt.disconnecting) {
            logger.warn(`MQTT Channel disconnecting`);
        }
        else if (this._mqtt.connected) {
            logger.silly(`Sending on MQTT Channel ${JSON.stringify(opts)}`);
            this._mqtt.publish(opts.eventName, JSON.stringify(opts.value), { retain: true, qos: 2 }, (err) => {
                if (err) logger.error(err);
            });
        }
    }
}
export const connBroker = new ConnectionBroker()
