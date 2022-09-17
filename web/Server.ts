import * as path from "path";
import * as fs from "fs";
import express = require('express');
import { config } from "../config/Config";
import { logger } from "../logger/Logger";
// import socketio = require("socket.io");
import { Namespace, RemoteSocket, Server as SocketIoServer, Socket } from 'socket.io';
import * as http2 from "http2";
import * as http from "http";
import * as https from "https";
import { EventEmitter } from 'events';
import * as multicastdns from 'multicast-dns';
import * as ssdp from 'node-ssdp';
import * as os from 'os';
import { URL } from "url";
import { Timestamp } from '../boards/Constants';
import extend = require("extend");
import { ConfigRoute } from "./services/Config";
import { StateRoute } from "./services/State";
import { cont } from "../boards/Controller";
// This class serves data and pages for
// external interfaces as well as an internal dashboard.
export class WebServer {
    private _servers: ProtoServer[] = [];
    private family = 'IPv4';
    private _httpPort: number;
    constructor() { }
    public init() {
        let cfg = config.getSection('web');
        let srv;
        for (let s in cfg.servers) {
            let c = cfg.servers[s];
            switch (s) {
                case 'http':
                    srv = new HttpServer(s, s);
                    if (c.enabled !== false) this._httpPort = c.port;
                    break;
                case 'https':
                    srv = new Http2Server(s, s);
                    if (c.enabled !== false) this._httpPort = c.port;
                    break;
                case 'mdns':
                    srv = new MdnsServer(s, s);
                    break;
                case 'ssdp':
                    srv = new SsdpServer(s, s);
                    break;
            }
            if (typeof srv !== 'undefined') {
                this._servers.push(srv);
                srv.init(c);
                srv = undefined;
            }
        }
        for (let s in cfg.interfaces) {
            let int;
            let c = cfg.interfaces[s];
            if (!c.enabled) continue;
            let type = c.type || 'http';
            logger.info(`Init ${type} interface: ${c.name}`);
            switch (type) {
                case 'http':
                    //int = new HttpInterfaceServer();
                    //int.init(c);
                    this._servers.push(int);
                    break;
            }
        }
    }
    public emitToClients(evt: string, ...data: any) {
        for (let i = 0; i < this._servers.length; i++) {
            this._servers[i].emitToClients(evt, ...data);
        }
    }
    public emitToChannel(channel: string, evt: string, ...data: any) {
        for (let i = 0; i < this._servers.length; i++) {
            this._servers[i].emitToChannel(channel, evt, ...data);
        }
    }
    public async stopAsync() {
        try {
            // We want to stop all the servers in reverse order so let's pop them out.
            for (let s in this._servers) {
                try {
                    let serv = this._servers[s];
                    if (typeof serv.stopAsync === 'function') {
                        await serv.stopAsync();
                    }
                    this._servers[s] = undefined;
                } catch (err) { console.log(`Error stopping server ${s}: ${err.message}`); }
            }
        } catch (err) { `Error stopping servers` }
    }
    private getInterface() {
        const networkInterfaces = os.networkInterfaces();
        // RKS: We need to get the scope-local nic. This has nothing to do with IP4/6 and is not necessarily named en0 or specific to a particular nic.  We are
        // looking for the first IPv4 interface that has a mac address which will be the scope-local address.  However, in the future we can simply use the IPv6 interface
        // if that is returned on the local scope but I don't know if the node ssdp server supports it on all platforms.
        for (let name in networkInterfaces) {
            let nic = networkInterfaces[name];
            for (let ndx in nic) {
                let addr = nic[ndx];
                // All scope-local addresses will have a mac.  In a multi-nic scenario we are simply grabbing
                // the first one we come across.
                if (!addr.internal && addr.mac.indexOf('00:00:00:') < 0 && addr.family === this.family) {
                    return addr;
                }
            }
        }
    }
    public ip() { return typeof this.getInterface() === 'undefined' ? '0.0.0.0' : this.getInterface().address; }
    public mac() { return typeof this.getInterface() === 'undefined' ? '00:00:00:00' : this.getInterface().mac; }
    public httpPort(): number { return this._httpPort }
    public findServer(name: string): ProtoServer { return this._servers.find(elem => elem.name === name); }
}
class ProtoServer {
    constructor(name: string, type: string) { this.name = name; this.type = type; }
    public name: string;
    public type: string;
    public uuid: string;
    public remoteConnectionId: string;
    // base class for all servers.
    public isRunning: boolean = false;
    public get isConnected() { return this.isRunning; }
    public emitToClients(evt: string, ...data: any) { }
    public emitToChannel(channel: string, evt: string, ...data: any) { }
    public async init(obj: any) { };
    public async stopAsync() { }
    protected _dev: boolean = process.env.NODE_ENV !== 'production';
}
export class Http2Server extends ProtoServer {
    public server: http2.Http2Server;
    public app: Express.Application;
    public async init(cfg) {
        this.uuid = cfg.uuid;
        if (cfg.enabled) {
            this.app = express();
            // TODO: create a key and cert at some time but for now don't fart with it.
        }
    }
}
interface ClientToServerEvents {
    noArg: () => void;
    basicEmit: (a: number, b: string, c: number[]) => void;
}

interface ServerToClientEvents {
    withAck: (d: string, cb: (e: number) => void) => void;
}
export class HttpServer extends ProtoServer {
    // Http protocol
    public app: express.Application;
    public server: http.Server;
    public sockServer: SocketIoServer<ClientToServerEvents, ServerToClientEvents>;
    private _nameSpace: Namespace;
    private _sockets: RemoteSocket<ServerToClientEvents, any>[] = [];
    public emitToClients(evt: string, ...data: any) {
        if (this.isRunning) {
            this._nameSpace.emit(evt, ...data);
        }
    }
    public emitToChannel(channel: string, evt: string, ...data: any) {
        //console.log(`Emitting to channel ${channel} - ${evt}`)
        if (this.isRunning) {
            let _nameSpace: Namespace = this.sockServer.of(channel);
            _nameSpace.emit(evt, ...data);
        }
    }
    private initSockets() {
        let options = {
            allowEIO3: true, 
                cors: {
                    origin: true,
                    methods: ["GET", "POST"],
                    credentials: true
                }
        }
        this.sockServer = new SocketIoServer(this.server, options);
        this._nameSpace = this.sockServer.of('/');
        //this.sockServer.origins('*:*');

        this.sockServer.on('connection', (sock: Socket) => {
            logger.info(`New socket client connected ${sock.id} -- ${sock.client.conn.remoteAddress}`);
            this.socketHandler(sock);
            sock.on('connect_error', (err) => {
                logger.error('Socket server error %s', err.message);
            });
            sock.on('reconnect_failed', (err) => {
                logger.error('Failed to reconnect with socket %s', err.message);
            });
        });
        this.app.use('/socket.io-client', express.static(path.join(process.cwd(), '/node_modules/socket.io-client/dist/'), { maxAge: '60d' }));
    }
    private socketHandler(sock: Socket) {
        let self = this;
        setTimeout(async () => {
            // refresh socket list with every new socket
            self._sockets = await self.sockServer.fetchSockets();
        }, 100)
        sock.on('error', (err) => {
            logger.error('Error with socket: %s', err);
        });
        sock.on('close', async (id) => {
            logger.info('Socket diconnecting %s', id);
            self._sockets = await self.sockServer.fetchSockets();
        });
        sock.on('echo', (msg) => { sock.emit('echo', msg); });
    }
    public async init(cfg) {
        if (cfg.enabled) {
            this.app = express();

            //this.app.use();
            this.server = http.createServer(this.app);

            if (cfg.httpsRedirect) {
                var cfgHttps = config.getSection('web').server.https;
                this.app.get('*', (res: express.Response, req: express.Request) => {
                    let host = res.get('host');
                    host = host.replace(/:\d+$/, ':' + cfgHttps.port);
                    return res.redirect('https://' + host + req.url);
                });
            }
            this.app.use(express.json());
            this.app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
                res.header('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, DELETE');
                if ('OPTIONS' === req.method) { res.sendStatus(200); }
                else {
                    if (req.url !== '/device') {
                        logger.verbose(`${req.ip} ${req.method} ${req.url} ${typeof req.body === 'undefined' ? '' : JSON.stringify(req.body)}`);
                    }
                    next();
                }
            });
            this.app.use(express.static(path.join(process.cwd(), 'pages'), { maxAge: '1d' }));

            // Put in a custom replacer so that we can send error messages to the client.  If we don't do this the base properties of Error
            // are omitted from the output.
            this.app.set('json replacer', (key, value) => {
                if (value instanceof Error) {
                    var err = {};
                    Object.getOwnPropertyNames(value).forEach((prop) => { err[prop] = value[prop]; });
                    return err;
                }
                return value;
            });


            // The socket initialization needs to occur before we start listening.  If we don't then
            // the headers from the server will not be picked up.
            this.initSockets();

            // start our server on port
            this.server.listen(cfg.port, cfg.ip, function () {
                logger.info('Server is now listening on %s:%s', cfg.ip, cfg.port);
            });
            this.app.use('/socket.io-client', express.static(path.join(process.cwd(), '/node_modules/socket.io-client/dist/'), { maxAge: '60d' }));
            this.app.use('/jquery', express.static(path.join(process.cwd(), '/node_modules/jquery/'), { maxAge: '60d' }));
            this.app.use('/jquery-ui', express.static(path.join(process.cwd(), '/node_modules/jquery-ui-dist/'), { maxAge: '60d' }));
            this.app.use('/jquery-ui-touch-punch', express.static(path.join(process.cwd(), '/node_modules/jquery-ui-touch-punch-c/'), { maxAge: '60d' }));
            this.app.use('/font-awesome', express.static(path.join(process.cwd(), '/node_modules/@fortawesome/fontawesome-free/'), { maxAge: '60d' }));
            this.app.use('/codejar', express.static(path.join(process.cwd(), '/node_modules/codejar/'), { maxAge: '60d' }));
            this.app.use('/prismjs', express.static(path.join(process.cwd(), '/node_modules/prismjs/'), { maxAge: '60d' }));
            this.app.use('/themes', express.static(path.join(process.cwd(), '/themes/'), { maxAge: '1d' }));
            this.app.use('/upnp.xml', async (req, res, next) => {
                try {
                    // Put together the upnp device description.
                    let ssdp = webApp.findServer('ssdp') as SsdpServer;
                    if (typeof ssdp === 'undefined') throw new Error(`SSDP Server not initialized.  No upnp information available.`);
                    res.status(200).set('Content-Type', 'text/xml').send(ssdp.deviceXML());
                } catch (err) { next(err); }
            });

            this.app.get('/config/:section', (req, res) => {
                return res.status(200).send(config.getSection(req.params.section));
            });
            this.app.use((req, res, next) => {
                logger.info(`[${new Date().toLocaleTimeString()}] ${req.ip} ${req.method} ${req.url} ${typeof req.body === 'undefined' ? '' : JSON.stringify(req.body)}`);
                next()
            });
            ConfigRoute.initRoutes(this.app);
            StateRoute.initRoutes(this.app);

            this.isRunning = true;
            this.app.use((error, req, res, next) => {
                logger.error(error);
                if (!res.headersSent) {
                    let httpCode = error.httpCode || 500;
                    if (typeof error !== 'undefined' && typeof error.message !== 'undefined')
                        res.status(httpCode).send(error);
                    else {
                        let err = { httpCode: httpCode, message: error };
                        res.status(httpCode).send(err);
                    }
                }
            });

        }
    }
}
export class SsdpServer extends ProtoServer {
    // Simple service discovery protocol
    public server: any; //node-ssdp;
    public deviceUUID: string;
    public upnpPath: string;
    public modelName: string;
    public modelNumber: string;
    public serialNumber: string;
    public deviceType = 'urn:schemas-rstrouse-org:device:relayEquipmentManager:1';
    public async init(cfg) {
        this.uuid = cfg.uuid;
        if (cfg.enabled) {
            let self = this;
            logger.info('Starting up SSDP server');
            this.deviceUUID = 'uuid:BA759957-E2F3-4E90-9226-' + webApp.mac().replace(/:/g, '');
            this.serialNumber = webApp.mac();
            this.modelName = `REM v${cont.appVersion}`;
            this.modelNumber = `REM${cont.appVersion.replace(/\./g, '-')}`;
            // todo: should probably check if http/https is enabled at this point
            let port = config.getSection('web').servers.http.port || 8080;
            this.upnpPath = 'http://' + webApp.ip() + ':' + port + '/upnp.xml';
            let SSDP = ssdp.Server;
            this.server = new SSDP({
                //customLogger: (...args) => console.log.apply(null, args),
                logLevel: 'INFO',
                udn: this.deviceUUID,
                location: this.upnpPath,
                sourcePort: 1900
            });
            this.server.addUSN('upnp:rootdevice'); // This line will make the server show up in windows.
            this.server.addUSN(this.deviceType);
            // start the server
            this.server.start()
                .then(function () {
                    logger.silly('SSDP/UPnP Server started.');
                    self.isRunning = true;
                }).catch(err => logger.error(`Error starting SSDP Server ${err.message}`));

            this.server.on('error', function (e) {
                logger.error('error from SSDP:', e);
            });
        }
    }
    public deviceXML(): string {
        let XML = `<?xml version="1.0"?>
        <root xmlns="urn:schemas-upnp-org:device-1-0">
            <specVersion>
                <major>1</major>
                <minor>0</minor>
            </specVersion>
            <device>
                <deviceType>${this.deviceType}</deviceType>
                <friendlyName>Relay Equipment Manager</friendlyName> 
                <manufacturer>rstrouse</manufacturer>
                <manufacturerURL>https://github.com/rstrouse/relayEquipmentManager</manufacturerURL>
                <presentationURL>http://${webApp.ip()}:${webApp.httpPort()}</presentationURL>
                <modelName>${this.modelName}</modelName>
                <modelNumber>${this.modelNumber}</modelNumber>
                <modelDescription>Mult-protocol device manager</modelDescription>
                <serialNumber>${this.serialNumber}</serialNumber>
                <UDN>${this.deviceUUID}::${this.deviceType}</UDN>
                <serviceList></serviceList>
                <deviceList></deviceList>
            </device>
        </root>`;
        return XML;
    }
    public async stopAsync() {
        try {
            if (typeof this.server !== 'undefined') {
                this.server.stop();
                logger.info(`Stopped SSDP server: ${this.name}`);
            }
        } catch (err) { logger.error(`Error stopping SSDP server ${err.message}`); }
    }
}
export class MdnsServer extends ProtoServer {
    // Multi-cast DNS server
    public server;
    public mdnsEmitter = new EventEmitter();
    private queries = [];
    public async init(cfg) {
        if (cfg.enabled) {
            logger.info('Starting up MDNS server');
            this.server = multicastdns({ loopback: true });
            var self = this;

            // look for responses to queries we send
            // todo: need timeout on queries to remove them in case a bad query is sent
            this.server.on('response', function (responses) {
                self.queries.forEach(function (query) {
                    logger.silly(`looking to match on ${query.name}`);
                    responses.answers.forEach(answer => {
                        if (answer.name === query.name) {
                            logger.info(`MDNS: found response: ${answer.name} at ${answer.data}`);
                            // need to send response back to client here
                            self.mdnsEmitter.emit('mdnsResponse', answer);
                            // remove query from list
                            self.queries = self.queries.filter((value, index, arr) => {
                                if (value.name !== query.name) return arr;
                            });
                        }
                    });

                });
            });

            // respond to incoming MDNS queries
            this.server.on('query', function (query) {
                query.questions.forEach(question => {
                    if (question.name === '_poolcontroller._tcp.local') {
                        logger.info(`received mdns query for nodejs_poolController`);
                        self.server.respond({
                            answers: [{
                                name: '_poolcontroller._tcp.local',
                                type: 'A',
                                ttl: 300,
                                data: webApp.ip()
                            },
                            {
                                name: 'api._poolcontroller._tcp.local',
                                type: 'SRV',
                                data: {
                                    port: '4200',
                                    target: '_poolcontroller._tcp.local',
                                    weight: 0,
                                    priority: 10
                                }
                            }]
                        });
                    }
                });
            });

            this.isRunning = true;
        }
    }
    public queryMdns(query) {
        // sample query
        // queryMdns({name: '_poolcontroller._tcp.local', type: 'A'});
        if (this.queries.indexOf(query) === -1) {
            this.queries.push(query);
        }
        this.server.query({ questions: [query] });
    }
}
export const webApp = new WebServer();
