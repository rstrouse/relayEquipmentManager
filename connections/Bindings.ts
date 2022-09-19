import { connect, MqttClient, Client } from 'mqtt';
import { vMaps, utils } from "../boards/Constants";
import * as path from "path";
import * as fs from "fs";
import { cont, ConnectionSource, DeviceBinding, DataTrigger } from "../boards/Controller";
import { logger } from "../logger/Logger";
import { webApp } from "../web/Server";
import { i2c } from "../i2c-bus/I2cBus";
import { gdc } from "../generic/genericDevices";
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
    public async freeConnections() {
        try {
            for (let i = this.listeners.length - 1; i >= 0; i--) {
                await this.listeners[i].disconnect();
                this.listeners.splice(i, 1);
            }
        } catch (err) { logger.error(`Error closing connections: ${err.message}`); }
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
    public addConnection(conn) {
        try {
            let sc: ServerConnection;
            switch (conn.type.name) {
                case 'njspc':
                case 'webSocket':
                    sc = new SocketServerConnection(conn);
                    break;
                case 'mqttClient':
                    sc = new MqttConnection(conn);
                    break;
            }
            if (typeof sc !== 'undefined') {
                this.listeners.push(sc);
                sc.connect();
            }
        } catch (err) { logger.error(`Error adding connection: ${err.message}`); }
    }
    public init() {
        try {
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
        } catch (err) { logger.error(`Error Initializing Connections: ${err.message}`); }
    }
    public findServer(connectionId: number): ServerConnection {
        return this.listeners.find(elem => elem.connectionId === connectionId);
    }
    public async stopAsync() {
        this.freeConnections();
        return this;
    }
    public async setDeviceTrigger(binding, trigger: DataTrigger) {
        for (let i = 0; i < this.listeners.length; i++) {
            let server = this.listeners[i];
            await server.setDeviceTrigger(binding, trigger);
        }
    }
    public async deleteDeviceTrigger(binding, trigger?: DataTrigger) {
        for (let i = 0; i < this.listeners.length; i++) {
            let server = this.listeners[i];
            await server.deleteDeviceTrigger(binding, trigger);
        }
    }
}
export class ServerConnection {
    public server: ConnectionSource;
    public connectionId: number;
    constructor(server: ConnectionSource) { this.server = server; this.connectionId = server.id; }
    public isOpen = false;
    public async disconnect() {
        if (!this.isOpen) return;
    }
    public connect() {
        if (typeof this.server !== 'undefined') this.isOpen = true;
    }
    public send(opts) { }
    public async resetDeviceTriggers(binding?) { }
    public async setDeviceTrigger(binding, trigger: DataTrigger) { }
    public async deleteDeviceTrigger(binding, trigger?: DataTrigger) { }
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
                    await gdc.setDeviceValue(parseInt(arr[2], 10), opts.property, opts.value);
                }
            }
        } catch (err) { logger.error(`Error sending on internal connection ${opts.deviceBinding}: ${err.message}`); }
    }
}
class SocketServerConnection extends ServerConnection {
    private _sock;
    constructor(server: ConnectionSource) { super(server); }
    public events = [];
    public async disconnect() {
        try {
            if (typeof this._sock !== 'undefined') {
                this._sock.removeAllListeners();
                this._sock.disconnect();
            }
            super.disconnect();
        } catch (err) { logger.error(`Error disconnecting sockets for ${this.server.name}`); }
    }
    public async deleteDeviceTrigger(binding, trigger?: DataTrigger) {
        try {
            let evts = this.events.find(elem => elem.triggers.find(t => binding.startsWith(t.binding) && (trigger === undefined || t.triggerId === trigger.id)) !== undefined);
            for (let i = evts.length - 1; i >= 0; i--) {
                let evt = evts[i];
                for (let j = evt.triggers.length - 1; j >= 0; j--) {
                    let trig = evt.triggers[j];
                    if (trig.binding.startsWith(binding) && (typeof trigger === 'undefined' || trig.triggerId === trigger.id)) 
                        evt.triggers.splice(j, 1);
                }
                if (evt.triggers.length === 0) {
                    // Remove the event altogether.
                    this.events.splice(this.events.findIndex(elem => elem.name === evt.name), 1);
                    this._sock.off(evt.name);
                }
            }
        } catch (err) { logger.error(`Error deleting device triggers. ${binding}-${trigger.id}`) }
    }
    public async setDeviceTrigger(binding, trigger: DataTrigger) {
        try {
            // Find the existing trigger if it exists.  IF it doesn't we will add it.
            let evts = this.events.find(elem => elem.triggers.find(t => t.triggerId === trigger.id && t.binding.startsWith(binding)) !== undefined);
            // First if the trigger exist in another event that is not the current one we need to delete it.
            for (let i = evts.length - 1; i >= 0; i--) {
                let evt = evts[i];
                if (evt.name !== trigger.eventName || trigger.sourceId !== this.connectionId) {
                    // We found an event that is no longer associated with this trigger so we need to delete it.
                    for (let j = evt.triggers.length - 1; j >= 0; j--) {
                        let trig = evt.triggers[j];
                        if (trig.binding === binding && trig.triggerId === trigger.id) evt.triggers.splice(j, 1);
                    }
                }
                else if (evt.name === trigger.eventName) {
                    // We found our event that is associated with the trigger.  Update the functions.
                    for (let j = evt.triggers.length - 1; j >= 0; j--) {
                        let trig = evt.triggers[j];
                        if (trig.binding.startsWith(binding) && trig.triggerId === trigger.id) {
                            trig.filter = trigger.makeTriggerFunction();
                        }
                    }
                }
                if (evt.triggers.length === 0) {
                    // Remove the event altogether.
                    this.events.splice(this.events.findIndex(elem => elem.name === evt.name), 1);
                    this._sock.off(evt.name);
                }
            }
            if (typeof evts === 'undefined' || evts.length === 0) {
                // This trigger is not associated with an event so we need to add it in.
                let evt = { name: trigger.eventName, triggers: [] };
                this.events.push(evt);
                logger.info(`Binding ${evt.name} from ${this.server.name} to device ${binding}`);
                this._sock.on(evt.name, (data) => { this.processEvent(evt.name, data); });
                try {
                    let fnFilter = trigger.makeTriggerFunction();
                    evt.triggers.push({ filter: fnFilter, binding: binding, triggerId: trigger.id });
                }
                catch (err) { logger.error(`Invalid device ${binding} trigger Expression: ${err.message} : ${trigger.makeExpression()}`); }
            }
        } catch (err) { logger.error(`Error setting socket device trigger. ${binding}-${trigger.id}`) }
    }
    public async resetDeviceTriggers(binding?: string) {
        try {
            // First lets kill all the triggers and events.
            logger.info(`Resetting Device Triggers for ${binding}`);
            for (let i = this.events.length - 1; i >= 0; i--) {
                let evt = this.events[i];
                for (let j = evt.triggers.length - 1; j >= 0; j--) {
                    let trig = evt.triggers[j];
                    if (typeof binding === 'undefined' || trig.binding.startsWith(binding)) {
                        evt.triggers.splice(j, 1);
                        logger.info(`Removed trigger for ${binding} - ${evt.name}`);
                    }
                }
                if (evt.triggers.length === 0) {
                    // Kill the socket we don't need it.
                    this.events.splice(i, 1);
                    this._sock.off(evt.name);
                }
            }
            for (let i = 0; i < cont.gpio.pins.length; i++) {
                let pin = cont.gpio.pins.getItemByIndex(i);
                let deviceBinding = `gpio:${pin.headerId}:${pin.id}`;
                if (typeof binding !== 'undefined' && !binding.startsWith(deviceBinding)) continue;
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
                    catch (err) { logger.error(`Invalid Pin#${pin.id} trigger Expression: ${err.message} : ${trigger.makeExpression()}`); }
                }
            }
            for (let k = 0; k < cont.i2c.buses.length; k++) {
                let bus = cont.i2c.buses.getItemByIndex(k);
                for (let i = 0; i < bus.devices.length; i++) {
                    let device = bus.devices.getItemByIndex(i);
                    let deviceBinding = `i2c:${bus.id}:${device.id}`;
                    if (typeof binding !== 'undefined' && !binding.startsWith(deviceBinding)) continue;
                    let triggers = device.triggers.toArray();
                    for (let j = 0; j < triggers.length; j++) {
                        let trigger = triggers[j];
                        if (trigger.sourceId !== this.server.id || typeof trigger.eventName === 'undefined' || trigger.eventName === '') continue;
                        let evt = this.events.find(elem => elem.name === trigger.eventName);
                        if (typeof evt === 'undefined') {
                            evt = { name: trigger.eventName, triggers: [] };
                            logger.info(`Binding ${evt.name} from ${this.server.name} to i2c Device ${bus.busNumber}-${device.address} ${device.name}`);
                            this.events.push(evt);
                            this._sock.on(evt.name, (data) => { this.processEvent(evt.name, data); });
                        }
                        try {
                            let fnFilter = trigger.makeTriggerFunction();
                            evt.triggers.push({
                                binding: `i2c:${bus.id}:${device.id}${typeof trigger.channelId !== 'undefined' ? ':' + trigger.channelId : ''}`,
                                filter: fnFilter, triggerId: trigger.id
                            });
                        }
                        catch (err) { logger.error(`Invalid I2c Device ${device.id} trigger Expression: ${err.message} : ${trigger.makeExpression()}`); }
                    }
                }
            }

        } catch (err) { logger.error(`Error resetting device triggers ${binding}`); }
    }
    public processEvent(event, data) {
        // Find the event.
        if (!this.isOpen) {
            return;
        }
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
                    if (trig.binding.startsWith('gpio')) {
                        if (!device.isOutput) continue;
                        (async () => {
                            try {
                                let val = trigger.state.val;
                                if (val === 2) {
                                    val = !utils.makeBool(device.state.boolean); // Just in case we are unknown state.
                                }
                                await device.setDeviceState({ state: val });
                            } catch (err) { }
                        })();
                    }
                    else (async () => {
                        try {

                            if (typeof trigger.stateExpression !== 'undefined' && trigger.stateExpression.length > 0) {
                                try {
                                    let fnTransform = new Function('connection', 'trigger', 'device', 'data', trigger.stateExpression);
                                    data = fnTransform(this, trigger, device, data);
                                } catch (err) { logger.error(`Trigger for device ${trig.binding} cannot evaluate binding function ${err.message}`); }
                            }
                            await device.setDeviceState(trig.binding, data);
                        } catch (err) { logger.error(`Error processing Socket event ${event}: ${err.message}`); }
                    })();
                    //if (trig.binding.startsWith('gpio')) device.setDeviceState({ state: trigger.state.val });
                    //else device.setDeviceState(trig.binding, data);
                }
            }
        }
    }
    public connect() {
        try {
            let url = this.server.url;
            this._sock = io(url, { reconnectionDelay: 2000, reconnection: true, reconnectionDelayMax: 20000 });
            this._sock.on('connect_error', (err) => { logger.error(`Error connecting to ${this.server.name} ${url}: ${err.message}`); });
            this._sock.on('error', (err) => { logger.error(`Socket Error ${this.server.name} ${url}: ${err.message}`); })
            this._sock.on('close', (sock) => { this.isOpen = false; logger.info(`Socket ${this.server.name} ${url} closed`); });
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
                        catch (err) { logger.error(`Invalid Pin#${pin.id} trigger Expression: ${err.message} : ${trigger.makeExpression()}`); }
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
                                    binding: `i2c:${bus.id}:${device.id}${typeof trigger.channelId !== 'undefined' ? ':' + trigger.channelId : ''}`,
                                    filter: fnFilter, triggerId: trigger.id
                                });
                            }
                            catch (err) { logger.error(`Invalid I2c Device ${device.id} trigger Expression: ${err.message} : ${trigger.makeExpression()}`); }
                        }
                    }
                }
                this.isOpen = true;
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
                //            catch (err) { logger.error(`Invalid Pin#${pin.id} trigger Expression: ${err.message} : ${trigger.makeExpression()}`); }

                //        }
                //    }
                //}
            });
        } catch (err) { logger.error(`Error connecting to server ${this.server.name}: ${err.message}`); }
    }
    public send(opts) {
        try {
            let obj = {};
            obj[opts.property] = opts.value;
            if (typeof opts.options === 'object') obj = extend(true, obj, opts.options);
            logger.verbose(`Emitting: /${opts.eventName} : ${JSON.stringify(obj)}`);
            this._sock.emit('/' + opts.eventName, JSON.stringify(obj));
        } catch (err) { logger.error(`Error sending on socket server ${this.server.name}: ${err.message}`); }
    }
}
class MqttConnection extends ServerConnection {
    private _mqtt: MqttClient;
    public events = [];
    public subscribed = false;
    constructor(server: ConnectionSource) { super(server); }
    public async disconnect() {
        try {
            if (typeof this._mqtt !== 'undefined') {
                this._mqtt.removeAllListeners();
                this._mqtt.on('error', err => logger.error(`MQTT Error: ${err}`));
                this._mqtt.end(false);
            }
            this.isOpen = false;
            super.disconnect();
        } catch (err) { logger.error(`Error disconnecting MQTT ${this.server.name}`); }
    }
    public async deleteDeviceTrigger(binding, trigger?: DataTrigger) {
        try {
            let evts = this.events.find(elem => elem.triggers.find(t => binding.startsWith(t.binding) && (trigger === undefined || t.triggerId === trigger.id)) !== undefined);
            for (let i = evts.length - 1; i >= 0; i--) {
                let evt = evts[i];
                for (let j = evt.triggers.length - 1; j >= 0; j--) {
                    let trig = evt.triggers[j];
                    if (trig.binding.startsWith(binding) && (typeof trigger === 'undefined' || trig.triggerId === trigger.id))
                        evt.triggers.splice(j, 1);
                }
                if (evt.triggers.length === 0) {
                    // Remove the event altogether.
                    this.events.splice(this.events.findIndex(elem => elem.topic === evt.topic), 1);
                    try { this._mqtt.unsubscribe(evt.topic); } catch (err) { logger.error(`Error unsubscribing to MQTT topic ${evt.topic}`); }
                }
            }
        } catch (err) { logger.error(`Error deleting device triggers. ${binding}-${trigger.id}`) }
    }
    public async setDeviceTrigger(binding, trigger: DataTrigger) {
        try {
            // Find the existing trigger if it exists.  IF it doesn't we will add it.
            let evts = this.events.find(elem => elem.triggers.find(t => t.triggerId === trigger.id && t.binding.startsWith(binding)) !== undefined);
            // First if the trigger exist in another event that is not the current one we need to delete it.
            for (let i = evts.length - 1; i >= 0; i--) {
                let evt = evts[i];
                if (evt.topic !== trigger.eventName || trigger.sourceId !== this.connectionId) {
                    // We found an event that is no longer associated with this trigger so we need to delete it.
                    for (let j = evt.triggers.length - 1; j >= 0; j--) {
                        let trig = evt.triggers[j];
                        if (trig.binding.startsWith(binding) && trig.triggerId === trigger.id) evt.triggers.splice(j, 1);
                    }
                }
                else if (evt.topic === trigger.eventName) {
                    // We found our event that is associated with the trigger.  Update the functions.
                    for (let j = evt.triggers.length - 1; j >= 0; j--) {
                        let trig = evt.triggers[j];
                        if (trig.binding === binding && trig.triggerId === trigger.id) {
                            trig.filter = trigger.makeTriggerFunction();
                        }
                    }
                }
                if (evt.triggers.length === 0) {
                    // Remove the event altogether.
                    this.events.splice(this.events.findIndex(elem => elem.name === evt.name), 1);
                    try { this._mqtt.unsubscribe(evt.topic); } catch (err) { logger.error(`Error unsubscribing to MQTT topic ${evt.topic}`); }
                }
            }
            if (typeof evts === 'undefined' || evts.length === 0) {
                // This trigger is not associated with an event so we need to add it in.
                let evt = { topic: trigger.eventName, triggers: [] };
                this.events.push(evt);
                logger.info(`Binding MQTT Topic ${evt.topic} from ${this.server.name} to device ${binding}`);
                this._mqtt.subscribe(evt.topic, (err, granted) => {
                    if (err)
                        logger.error(`Error binding MQTT ${evt.topic} from ${this.server.name} to Device ${binding} ${err}`);
                    else
                        logger.info(`Bound MQTT ${evt.topic} from ${this.server.name} to ${binding}`);
                });
                try {
                    let fnFilter = trigger.makeTriggerFunction();
                    evt.triggers.push({ filter: fnFilter, binding: binding, triggerId: trigger.id });
                } catch (err) { logger.error(`Invalid device ${binding} trigger Expression: ${err.message} : ${trigger.makeExpression()}`); }
            }
        } catch (err) { logger.error(`Error setting socket device trigger. ${binding}-${trigger.id}`) }
    }
    public async resetDeviceTriggers(binding?: string) {
        try {
            // First lets kill all the triggers and events.
            for (let i = this.events.length - 1; i >= 0; i--) {
                let evt = this.events[i];
                for (let j = evt.triggers.length - 1; j >= 0; j--) {
                    let trig = evt.triggers[j];
                    if (typeof binding === 'undefined' || trig.binding.startsWith(binding)) {
                        logger.info(`Resetting device triggers for MQTT event ${evt.topic} - ${binding}`);
                        evt.triggers.splice(j, 1);
                    }
                }
                if (evt.triggers.length === 0) {
                    // Kill the topic we don't need it.
                    logger.info(`Unsubscribing MQTT topic ${evt.topic}`);
                    try {
                        await this._mqtt.unsubscribe(evt.topic);
                        logger.info(`Unsubscribed from ${evt.topic}`);
                    } catch (err) { logger.error(`Error unsubscribing to MQTT topic ${evt.topic}`); }
                    this.events.splice(i, 1);
                }
            }
            for (let i = 0; i < cont.gpio.pins.length; i++) {
                let pin = cont.gpio.pins.getItemByIndex(i);
                let triggers = pin.triggers.toArray();
                for (let j = 0; j < triggers.length; j++) {
                    let trigger = triggers[j];
                    if (trigger.sourceId !== this.server.id || typeof trigger.eventName === 'undefined' || trigger.eventName === '') continue;
                    let deviceBinding = `gpio:${pin.headerId}:${pin.id}`;
                    if (typeof binding !== 'undefined' && !binding.startsWith(deviceBinding)) continue;
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
                    catch (err) { logger.error(`Invalid Pin#${pin.id} trigger Expression: ${err.message} : ${trigger.makeExpression()}`); }
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
                        let deviceBinding = `i2c:${bus.id}:${device.id}`;
                        if (typeof binding !== 'undefined' && !binding.startsWith(deviceBinding)) continue;
                        let evt = this.events.find(elem => elem.topic === trigger.eventName);
                        if (typeof evt === 'undefined') {
                            evt = { topic: trigger.eventName, triggers: [] };
                            this.events.push(evt);
                            this._mqtt.subscribe(evt.topic, (err, granted) => {
                                if (err)
                                    logger.error(`Error binding MQTT ${evt.topic} from ${this.server.name} to I2c Device ${bus.busNumber}-${device.address} ${device.name} ${err}`);
                                else
                                    logger.info(`Bound MQTT ${evt.topic} from ${this.server.name} to I2c Device ${bus.busNumber}-${device.address} ${device.name}`);
                            });
                        }
                        try {
                            let fnFilter = trigger.makeTriggerFunction();
                            evt.triggers.push({
                                binding: `i2c:${bus.id}:${device.id}${typeof trigger.channelId !== 'undefined' ? ':' + trigger.channelId : ''}`,
                                filter: fnFilter, triggerId: trigger.id
                            });
                        }
                        catch (err) { logger.error(`Invalid I2c Device ${device.id} trigger Expression: ${err.message} : ${trigger.makeExpression()}`); }
                    }
                }
            }
        } catch (err) { logger.error(`Error resetting device triggers ${binding}`); }
    }
    private initSubscribe() {
        // Put a list of events together for the devuces.
        this.resetDeviceTriggers();
        //for (let i = 0; i < cont.gpio.pins.length; i++) {
        //    let pin = cont.gpio.pins.getItemByIndex(i);
        //    let triggers = pin.triggers.toArray();
        //    for (let j = 0; j < triggers.length; j++) {
        //        let trigger = triggers[j];
        //        if (trigger.sourceId !== this.server.id || typeof trigger.eventName === 'undefined' || trigger.eventName === '') continue;
        //        let evt = this.events.find(elem => elem.topic === trigger.eventName);
        //        if (typeof evt === 'undefined') {
        //            evt = { topic: trigger.eventName, triggers: [] };
        //            this.events.push(evt);
        //            this._mqtt.subscribe(evt.topic, (err, granted) => {
        //                if (err)
        //                    logger.error(`Error binding MQTT ${evt.topic} from ${this.server.name} to pin ${pin.headerId}-${pin.id}`);
        //                else 
        //                    logger.info(`Bound MQTT ${evt.topic} from ${this.server.name} to pin ${pin.headerId}-${pin.id}`);
        //            });
        //        }
        //        try {
        //            let fnFilter = trigger.makeTriggerFunction();
        //            evt.triggers.push({ filter: fnFilter, binding: `gpio:${pin.headerId}:${pin.id}`, triggerId: trigger.id });
        //        }
        //        catch (err) { logger.error(`Invalid Pin#${pin.id} trigger Expression: ${err.message} : ${trigger.makeExpression()}`); }
        //    }
        //}
        //for (let k = 0; k < cont.i2c.buses.length; k++) {
        //    let bus = cont.i2c.buses.getItemByIndex(k);
        //    for (let i = 0; i < bus.devices.length; i++) {
        //        let device = bus.devices.getItemByIndex(i);
        //        let triggers = device.triggers.toArray();
        //        for (let j = 0; j < triggers.length; j++) {
        //            let trigger = triggers[j];
        //            if (trigger.sourceId !== this.server.id || typeof trigger.eventName === 'undefined' || trigger.eventName === '') continue;
        //            let evt = this.events.find(elem => elem.topic === trigger.eventName);
        //            if (typeof evt === 'undefined') {
        //                evt = { topic: trigger.eventName, triggers: [] };
        //                this.events.push(evt);
        //                this._mqtt.subscribe(evt.topic, (err, granted) => {
        //                    if (err)
        //                        logger.error(`Error binding MQTT ${evt.topic} from ${this.server.name} to I2c Device ${bus.busNumber}-${device.address} ${device.name}`);
        //                    else
        //                        logger.info(`Bound MQTT ${evt.topic} from ${this.server.name} to I2c Device ${bus.busNumber}-${device.address} ${device.name}`);
        //                });
        //            }
        //            try {
        //                let fnFilter = trigger.makeTriggerFunction();
        //                evt.triggers.push({
        //                    binding: `i2c:${bus.id}:${device.id}${typeof trigger.channelId !== 'undefined' ? ':' + trigger.channelId : ''}`,
        //                    filter: fnFilter, triggerId: trigger.id });
        //            }
        //            catch (err) { logger.error(`Invalid I2c Device ${device.id} trigger Expression: ${err.message} : ${trigger.makeExpression()}`); }
        //        }
        //    }
        //}
        if (this.subscribed) this._mqtt.off('message', this.messageHandler);
        this._mqtt.on('message', this.messageHandler)
        this.subscribed = true;
    }
    private initPublish() {

    }
    private messageHandler = async (topic, message) => {
        try {
            let msg = message.toString();
            let evt = this.events.find(elem => elem.topic === topic);
            if (typeof evt !== 'undefined') {
                logger.info(`Processing MQTT topic ${topic}`);
                // Do a little messag pre-processing because MQTT is lame.
                if (msg.startsWith('{') || msg.startsWith('[')) msg = JSON.parse(msg);
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
                        if (trig.binding.startsWith('gpio')) {
                            if (!device.isOutput) continue;
                            (async () => {
                                try {
                                    await device.setDeviceState({ state: trigger.state.val });
                                } catch (err) { }
                            })();
                        }
                        else (async () => {
                            try {
                                if (typeof trigger.stateExpression !== 'undefined' && trigger.stateExpression.length > 0) {
                                    try {
                                        let fnTransform = new Function('connection', 'trigger', 'device', 'data', trigger.stateExpression);
                                        msg = fnTransform(this, trigger, device, msg);
                                    } catch (err) { logger.error(`Trigger for device ${trig.binding} cannot evaluate binding function ${err.message}`); }
                                }
                                await device.setDeviceState(trig.binding, msg);
                            } catch (err) { logger.error(`Error processing MQTT topic ${evt.topic}: ${err.message}`); }
                        })();
                    }
                }
            }
        } catch (err) { logger.error(`Error Processing MQTT topic ${topic}`); }
    }
    public connect() {
        let url = this.server.url;
        logger.info(`Connecting mqtt to ${url}`);
        let opts = extend(true, {}, this.server.options);
        if (typeof this.server.userName !== 'undefined' && this.server.userName !== '') opts.username = this.server.userName;
        if (typeof this.server.password !== 'undefined' && this.server.password !== '') opts.password = this.server.password;
        try {
            this._mqtt = connect(url, opts);
            this._mqtt.on('connect', () => {
                logger.info(`MQTT Connected to ${url}`);
                this.isOpen = true;
                //this._mqtt.disconnecting = false;
                this.initSubscribe();
                this.initPublish();
            });
            this._mqtt.on('error', (err) => {
                logger.error(`Error connecting to MQTT server ${url}: ${err}`);
            });
        } catch (err) { logger.error(`Error connecting to MQTT broker ${err.message}`); }
    }
    public send(opts) {
        try {
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
                    if (err) logger.error(`MQTT Error publishing ${opts.eventName}:${err.message}`);
                });
            }
        } catch (err) { logger.error(`Error publishing to MQTT server: ${err.message}`); }
    }
}
export const connBroker = new ConnectionBroker()
