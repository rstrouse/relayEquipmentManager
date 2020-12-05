import { connect, MqttClient, Client } from 'mqtt';
import { vMaps } from "../boards/Constants";
import * as path from "path";
import * as fs from "fs";
import { cont, ConnectionSource } from "../boards/Controller";
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
        if (typeof evt !== 'undefined') {
            // Go through all the triggers to see if we find one.
            //console.log('Processing event:' + event);
            let states = [];
            for (let i = 0; i < evt.triggers.length; i++) {
                let trigger = evt.triggers[i];
                if (trigger.trigger.sourceId !== this.server.id) continue;
                if (trigger.usePinId && data.pinId !== trigger.pin.id) continue;
                try {
                    let val = trigger.filter(this.server.get(true), trigger.pin.get(true), trigger.trigger.get(true), data);
                    //console.log(trigger.filter);
                    if (val === true) {
                        //console.log(trigger.trigger.state);
                        let p = states.find(elem => elem.id === trigger.pin.id);
                        if (typeof p === 'undefined') {
                            p = { id: trigger.pin.id, pin: trigger.pin };
                            states.push(p);
                        }
                        p.state = trigger.trigger.state.name;
                    }
                } catch (err) {
                    logger.error(`Error processing filter expression for Pin #${trigger.pin.id}. ${err}`);
                }
            }
            // Go through an set all my states for the event.
            for (let i = 0; i < states.length; i++) {
                let state = states[i];
                state.pin.state = state.state;
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
            let bindings = ConnectionBindings.loadBindingsByConnectionType(this.server.type);
            // Go through each of the sockets and add them in.
            for (let i = 0; i < cont.gpio.pins.length; i++) {
                let pin = cont.gpio.pins.getItemByIndex(i);
                for (let k = 0; k < pin.triggers.length; k++) {
                    let trigger = pin.triggers.getItemByIndex(k);
                    if (!trigger.isActive) continue;
                    if (trigger.sourceId !== this.server.id) continue;
                    // See if there is a binding for this connection type.
                    let binding = bindings.events.find(elem => elem.name === trigger.eventName);
                    if (typeof trigger.eventName !== 'undefined' && trigger.eventName !== '') {
                        let evt = this.events.find(elem => elem.name === trigger.eventName);
                        if (typeof evt === 'undefined') {
                            evt = { name: trigger.eventName, triggers: [] };
                            this.events.push(evt);
                            logger.info(`Binding ${evt.name} from ${this.server.name}`);
                            this._sock.on(evt.name, (data) => { this.processEvent(evt.name, data); });
                        }
                        try {
                            let fnFilter = trigger.makeTriggerFunction();
                            evt.triggers.push({ pin: pin, filter: fnFilter, trigger: trigger });
                        }
                        catch (err) { logger.error(`Invalid Pin#${pin.id} trigger Expression: ${err} : ${trigger.makeExpression()}`); }
                       
                    }
                }
            }
        });
    }
    public send(opts) {
        let obj = {};
        obj[opts.property] = opts.value;
        if (typeof opts.options === 'object') obj = extend(true, obj, opts.options);
        console.log(`Emitting: /${opts.eventName} : ${JSON.stringify(obj)}`);
        this._sock.emit('/' + opts.eventName, JSON.stringify(obj));
    }
}
class MqttConnection extends ServerConnection {
    private _mqtt: MqttClient;
    constructor(server: ConnectionSource) { super(server); }
    public disconnect() {
        if (typeof this._mqtt !== 'undefined') this._mqtt.removeAllListeners();
        this._mqtt.end(false);
        this.isOpen = false;
        super.disconnect();
    }
    private initSubscribe() {

    }
    private initPublish() {

    }
    public connect() {
        let url = this.server.url;
        logger.info(`Connecting mqtt to ${url}`);
        this._mqtt = connect(url, this.server.options);
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
                if (err) console.log(err);
            });
        }
    }
}
export const connBroker = new ConnectionBroker()
