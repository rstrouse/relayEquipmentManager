"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Constants_1 = require("../boards/Constants");
const path = require("path");
const fs = require("fs");
const Controller_1 = require("../boards/Controller");
const Logger_1 = require("../logger/Logger");
const io = require('socket.io-client');
//import io from "socket.io-client";
//import { Server } from "http";
class ConnectionBindings {
    static loadBindingsByConnectionType(name) {
        let conn = typeof name === 'string' ? Constants_1.vMaps.connectionTypes.transformByName(name) : name;
        let cfgFile = conn.bindings;
        let bindings;
        if (typeof cfgFile === 'string') {
            let filePath = path.posix.join(process.cwd(), `/connections/${cfgFile}`);
            bindings = JSON.parse(fs.readFileSync(filePath, 'utf8').trim());
            bindings.dataTypes = this.dataTypes;
            bindings.operatorTypes = Constants_1.vMaps.operators.toArray();
        }
        return bindings;
    }
}
ConnectionBindings.dataTypes = {
    boolean: { operators: ['eq'], values: [{ val: 'true', name: 'True' }, { val: 'false', name: 'False' }] },
    string: { operators: ['eq', 'gt', 'lt', 'gte', 'lte', 'neq'] },
    number: { operators: ['eq', 'gt', 'lt', 'gte', 'lte', 'neq'] }
};
exports.ConnectionBindings = ConnectionBindings;
class ConnectionBroker {
    constructor() {
        this.listeners = [];
    }
    compile() {
        this.freeConnections();
        this.init();
    }
    freeConnections() {
        for (let i = this.listeners.length - 1; i >= 0; i--) {
            this.listeners[i].disconnect();
            this.listeners.splice(i, 1);
        }
    }
    deleteConnection(id) {
        for (let i = this.listeners.length - 1; i >= 0; i--) {
            let listener = this.listeners[i];
            if (typeof listener !== 'undefined' && listener.server.id === id) {
                listener.disconnect();
                this.listeners.splice(i, 1);
            }
        }
    }
    init() {
        for (let i = 0; i < Controller_1.cont.connections.length; i++) {
            let source = Controller_1.cont.connections.getItemByIndex(i);
            if (!source.isActive)
                continue;
            switch (source.type.name) {
                case 'njspc':
                case 'webSocket':
                    this.listeners.push(new SocketServerConnection(source));
                    break;
            }
        }
        for (let i = 0; i < this.listeners.length; i++) {
            this.listeners[i].connect();
        }
    }
    async stopAsync() {
        this.freeConnections();
        return this;
    }
}
exports.ConnectionBroker = ConnectionBroker;
class ServerConnection {
    constructor(server) {
        this.isOpen = false;
        this.server = server;
    }
    disconnect() {
        if (!this.isOpen)
            return;
    }
    connect() {
        if (typeof this.server !== 'undefined')
            this.isOpen = true;
    }
}
class SocketServerConnection extends ServerConnection {
    constructor(server) {
        super(server);
        this.events = [];
    }
    disconnect() {
        if (typeof this._sock !== 'undefined')
            this._sock.removeAllListeners();
        this._sock.disconnect();
        super.disconnect();
    }
    processEvent(event, data) {
        // Find the event.
        var evt = this.events.find(elem => elem.name === event);
        if (typeof evt !== 'undefined') {
            // Go through all the triggers to see if we find one.
            //console.log('Processing event:' + event);
            let states = [];
            for (let i = 0; i < evt.triggers.length; i++) {
                let trigger = evt.triggers[i];
                if (trigger.checkPinId && data.pinId !== trigger.pin.id)
                    continue;
                let val = trigger.filter(data);
                if (val === true) {
                    //console.log(trigger.trigger.state);
                    let p = states.find(elem => elem.id === trigger.pin.id);
                    if (typeof p === 'undefined') {
                        p = { id: trigger.pin.id, pin: trigger.pin };
                        states.push(p);
                    }
                    p.state = trigger.trigger.state.name;
                }
            }
            // Go through an set all my states for the event.
            for (let i = 0; i < states.length; i++) {
                let state = states[i];
                state.pin.state = state.state;
            }
        }
        //logger.info(`event:${event} data: ${JSON.stringify(data)}`);
    }
    connect() {
        let url = this.server.url;
        this._sock = io(url, { reconnectionDelay: 2000, reconnection: true, reconnectionDelayMax: 20000 });
        this._sock.on('connect_error', (err) => { Logger_1.logger.error(`Error connecting to ${this.server.name} ${url}: ${err}`); });
        this._sock.on('close', (sock) => { Logger_1.logger.info(`Socket ${this.server.name} ${url} closed`); });
        this._sock.on('reconnecting', (sock) => { Logger_1.logger.info(`Reconnecting to ${this.server.name} : ${url}`); });
        this._sock.on('connect', (sock) => {
            Logger_1.logger.info(`Connected to ${this.server.name} : ${url}`);
            let bindings = ConnectionBindings.loadBindingsByConnectionType(this.server.type);
            // Go through each of the sockets and add them in.
            for (let i = 0; i < Controller_1.cont.gpio.pins.length; i++) {
                let pin = Controller_1.cont.gpio.pins.getItemByIndex(i);
                for (let k = 0; k < pin.triggers.length; k++) {
                    let trigger = pin.triggers.getItemByIndex(k);
                    if (!trigger.isActive)
                        continue;
                    // See if there is a binding for this connection type.
                    let binding = bindings.events.find(elem => elem.name === trigger.eventName);
                    if (typeof trigger.eventName !== 'undefined' && trigger.eventName !== '') {
                        let evt = this.events.find(elem => elem.name === trigger.eventName);
                        if (typeof evt === 'undefined') {
                            evt = { name: trigger.eventName, triggers: [] };
                            this.events.push(evt);
                            Logger_1.logger.info(`Binding ${evt.name} from ${this.server.name}`);
                            this._sock.on(evt.name, (data) => { this.processEvent(evt.name, data); });
                        }
                        evt.triggers.push({
                            pin: pin, filter: new Function('data', trigger.makeExpression('data')), trigger: trigger,
                            checkPinId: typeof binding !== 'undefined' && binding.hasPinId === true && binding.hasId === true && typeof trigger.equipmentId === 'undefined'
                        });
                    }
                }
            }
        });
    }
}
exports.connBroker = new ConnectionBroker();
//# sourceMappingURL=Bindings.js.map