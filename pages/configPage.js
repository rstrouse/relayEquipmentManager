(function ($) {
    $.widget('pic.configPage', {
        options: { cfg: {} },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
        },
        _onTabChanged: function (evt) {
            var self = this, o = self.options, el = self.element;
            switch (evt.newTab.id) {
                case 'tabGeneral':
                    evt.newTab.contents.empty();
                    $('<div></div>').appendTo(evt.newTab.contents).pnlCfgGeneral();
                    break;
                case 'tabGpio':
                    evt.newTab.contents.empty();
                    $('<div></div>').appendTo(evt.newTab.contents).pnlCfgGpio();
                    break;
            }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            var tabs = $('<div class="picTabPanel"></div>');
            tabs.appendTo(el);
            tabs.tabBar();
            tabs.find('div.picTabContents').addClass('picConfigTabContents');
            tabs.on('tabchange', function (evt) { self._onTabChanged(evt); });
            var evt = $.Event('loaded');
            var tab;
            tab = self._addConfigTab({ id: 'tabGeneral', text: 'General', cssClass: 'cfgGeneral' });
            tab = self._addConfigTab({ id: 'tabGpio', text: 'GPIO - Pinouts', cssClass: 'cfgGpio' });
            tabs[0].selectTabById('tabGeneral');
            self._initServices();
            el.trigger(evt);

        },
        _addConfigTab: function (attrs, subTabs) {
            var self = this, o = self.options, el = self.element;
            var divOuter = $('<div class="picConfigCategory"></div>');
            el.find('div.picTabPanel:first').each(function () {
                var contents = this.addTab(attrs);
                if (attrs.cssClass) divOuter.addClass(attrs.cssClass);
                divOuter.appendTo(contents);
                if (typeof attrs.oncreate === 'function') attrs.oncreate(contents);
                if (typeof subTabs !== 'undefined') {
                    var tabs = $('<div class="picTabPanel"></div>');
                    tabs.appendTo(contents);
                    tabs.tabBar();
                    tabs.find('div.picTabContents').addClass('picConfigTabContents');
                    //tabs.on('tabchange', function (evt) { self._onTabChanged(evt); });
                    for (var i = 0; i < subTabs.length; i++) {
                        var t = subTabs[i];
                        var c = tabs[0].addTab(t);
                        var d = $('<div class="picConfigCategory"></div>');
                        if (t.cssClass) d.addClass(t.cssClass);
                        d.appendTo(c);
                    }
                }
            });
            return divOuter;
        },
        _initServices: function () {
            var self = this, o = self.options, el = self.element;
            o.socket = io('/', { reconnectionDelay: 2000, reconnection: true, reconnectionDelayMax: 20000 });
            o.socket.on('gpioPin', (data) => {
                console.log({ evt: 'gpioPin', data: data });
                el.find('div.pin-header[data-id="' + data.headerId + '"]')
                    .find('div.header-pin[data-id="' + data.pinId + '"]')
                    .each(function () { this.state(data.state); });
                el.find('div#btnPinState[data-gpioid="' + data.gpioId + '"]').each(function () { this.val(makeBool(data.state) ? 'on' : 'off'); });
            });
            o.socket.on('connect_error', function (data) {
                console.log('connection error:' + data);
                o.isConnected = false;
                $('div.picController').each(function () {
                    this.setConnectionError({ status: { val: 255, name: 'error', desc: 'Connection Error' } });
                });
                el.find('div.picControlPanel').each(function () {
                    $(this).addClass('picDisconnected');
                });

            });
            o.socket.on('connect_timeout', function (data) {
                console.log('connection timeout:' + data);
            });

            o.socket.on('reconnect', function (data) {
                console.log('reconnect:' + data);
            });
            o.socket.on('reconnect_attempt', function (data) {
                console.log('reconnect attempt:' + data);
            });
            o.socket.on('reconnecting', function (data) {
                console.log('reconnecting:' + data);
            });
            o.socket.on('reconnect_failed', function (data) {
                console.log('reconnect failed:' + data);
            });
            o.socket.on('connect', function (sock) {
                console.log({ msg: 'socket connected:', sock: sock });
                o.isConnected = true;
                el.find('div.picControlPanel').each(function () {
                    $(this).removeClass('picDisconnected');
                });
            });
            o.socket.on('close', function (sock) {
                console.log({ msg: 'socket closed:', sock: sock });
                o.isConnected = false;
            });

        }
    });
    $.widget('pic.pnlCfgGeneral', {
        options: { cfg: {} },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            var tabs = $('<div class="picTabPanel"></div>');
            el.addClass('config-general');
            $.getLocalService('/config/options/general', null, function (data, status, xhr) {
                //console.log(data);
                var outer = $('<div></div>').appendTo(el).addClass('control-panel');
                var head = $('<div></div>').appendTo(outer).addClass('pnl-settings-header').addClass('control-panel-title');
                $('<span></span>').appendTo(head).addClass('header-text').text('Settings');

                var line = $('<div></div>').appendTo(outer);
                $('<div></div>').appendTo(line).pickList({
                    required: true,
                    bindColumn: 0, displayColumn: 1, labelText: 'Board', binding: 'controllerType',
                    columns: [{ hidden:true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }, { binding: 'desc', text: 'Controller Type', style: { width: '297px', whiteSpace:'nowrap' } }],
                    items: data.controllerTypes, inputAttrs: { style: { width: '10rem' } }, labelAttrs: { style: { width: '4rem' } }
                });
                $('<hr></hr>').appendTo(outer);
                var conns = $('<div></div>').appendTo(outer).pnlConnections();
                var btnPnl = $('<div class="btn-panel"></div>').appendTo(outer);
                $('<div></div>').appendTo(btnPnl).actionButton({ text: 'Reset Server', icon: '<i class="fas fa-power-off"></i>' })
                    .on('click', function (evt) {
                        var cont = dataBinder.fromElement(el);
                        $.putLocalService('/config/reset', cont, 'Resetting the Server Settings...', function (controller, status, xhr) {
                            console.log(controller);
                        });
                    });
                $('<div></div>').appendTo(btnPnl).actionButton({ text: 'Save Settings', icon: '<i class="fas fa-save"></i>' })
                    .on('click', function (evt) {
                        var cont = dataBinder.fromElement(el);
                        console.log(cont);
                        // Send this off to the service.
                        $.putLocalService('/config/general', cont, 'Saving Settings...', function (controller, status, xhr) {
                            console.log(controller);
                        });
                    });
                dataBinder.bind(outer, data.controller);
                conns[0].dataBind(data.controller.connections);
            });
        }
    });
    $.widget('pic.pnlCfgGpio', {
        options: {
            cfg: {},
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            var tabs = $('<div class="picTabPanel"></div>');
            el.addClass('config-gpio')
            $.getLocalService('/config/options/gpio', null, function (data, status, xhr) {
                console.log(data);
                // Let's draw the gpio headers.
                var headers = $('<div></div>').appendTo(el).addClass('gpio-headers');
                var pinDef = data.pinDefinitions || { headers: [] };
                var pinHeads = pinDef.headers;
                for (var ihead = 0; ihead < pinHeads.length; ihead++) {
                    var head = pinHeads[ihead];
                    $('<div></div>').appendTo(headers).pinHeader(head);
                    
                }
                $('<div></div>').appendTo(el).pnlPinDefinition({ headers: headers, pinDirections: data.pinDirections });
                el.on('selchanged', 'div.pin-header', function (evt) {
                    // Bind up the gpio data from our set.
                    // Lets round trip to the server to get the data we need for the specific pin.
                    $.getLocalService('/config/options/pin/' + evt.headerId + '/' + evt.newPinId, null, function (pin, status, xhr) {
                        // Find the pin definition from the header.
                        console.log(pin);
                        el.find('div.pnl-pin-definition').each(function () { console.log(this); this.dataBind(pin); });
                    });
                });
                let name = $('<div></div>').appendTo(el).addClass('pnl-gpio-board-name').text(data.pinDefinitions.name);
                if (typeof data.pinDefinitions.icon !== 'undefined') $('<i class="' + data.pinDefinitions.icon + '"></i>').appendTo(name);
                let pos = headers.position();
                name.css({ left: (pinHeads.length == 1 ? -57 : 75) + 'px', top: headers.height() / 2 + 'px' });
                name.css({ transform: 'rotate(270deg)' });
            });
        }
    });
    $.widget('pic.pnlPinDefinition', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (data) { return self.dataBind(data); };
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-pin-definition').addClass('control-panel');
            var pinDef = $('<div></div>').appendTo(el).addClass('pin-definition').hide();
            var outer = $('<div></div>').appendTo(pinDef).addClass('pnl-pin-outer');

            var head = $('<div></div>').appendTo(outer).addClass('pnl-pin-header').addClass('control-panel-title');
            $('<span></span>').appendTo(head).addClass('header-text').attr('data-bind', 'header.name');
            var pin = $('<div></div>').appendTo(outer).addClass('pin-definition-inner');
            var state = $('<div></div>').appendTo(outer).addClass('pin-state-panel').css({ display: 'inline-block' }).hide();
            $('<div></div>').appendTo(state).toggleButton({ id: 'btnPinState', labelText: 'Pin State' }).attr('data-gpioid', '')
                .on('click', function (evt) {
                    var pin = dataBinder.fromElement(pinDef);
                    pin.state = evt.currentTarget.val();
                    $.putLocalService('/state/setPinState', { gpioId: pin.gpioId, state: pin.state }, function(p, status, xhr) {
                        console.log(p);
                        evt.currentTarget.val(pin.state);
                    });
                });

            $('<input type="hidden"></input>').appendTo(pin).attr('data-bind', 'header.id').attr('data-datatype', 'int');
            $('<input type="hidden"></input>').appendTo(pin).attr('data-bind', 'id').attr('data-datatype', 'int');
            var line = $('<div></div>').appendTo(pin);
            $('<label></label>').appendTo(line).text('Pin #').css({ width: '4.5rem', display: 'inline-block' });
            $('<span></span>').appendTo(line).attr('data-bind', 'id').attr('data-datatype', 'int');
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Is Active', bind: 'isActive' }).css({ marginLeft: '2rem' });
            line = $('<div></div>').attr('id', 'divGPIOLine').appendTo(pin);
            $('<label></label>').appendTo(line).text('GPIO #').css({ width: '4.5rem', display: 'inline-block' });
            $('<span></span>').appendTo(line).attr('data-bind', 'gpioId').attr('data-datatype', 'int');
            line = $('<div></div>').appendTo(pin);
            $('<label></label>').appendTo(line).text('Name').css({ width: '4.5rem', display: 'inline-block' });
            $('<span></span>').appendTo(line).attr('data-bind', 'name');
            line = $('<div></div>').appendTo(pin);
            $('<div></div>').appendTo(line).pickList({
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Direction', binding: 'direction',
                columns: [{ hidden: true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }, { binding: 'desc', text: 'Pin Direction', style: { width: '250px' } }],
                items: o.pinDirections, inputAttrs: { style: { width: '7rem' } }, labelAttrs: { style: { width: '4.5rem' } }
            });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Inverted', bind: 'isInverted' });
            $('<hr></hr>').appendTo(el);
            var trigs = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(trigs).pnlPinTriggers().hide();
            $('<div></div>').appendTo(el).addClass('select-pin-message').text('Select a pin from the displayed header(s) to edit its defintion');
            var btnPnl = $('<div class="btn-panel"></div>').appendTo(el).hide();
            $('<div></div>').appendTo(btnPnl).actionButton({ text: 'Save Pin', icon: '<i class="fas fa-save"></i>' })
                .on('click', function (evt) {
                    var pin = dataBinder.fromElement(pinDef);
                    console.log(pin);
                    // Send this off to the service.
                    $.putLocalService('/config/pin/' + pin.header.id + '/' + pin.id, pin, 'Saving Pin Settings...', function (p, status, xhr) {
                        console.log(p);
                        self.dataBind({ pin: p });
                    });
                });
        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            el.find('div.pnl-pin-outer').each(function () { dataBinder.bind($(this), data.pin); });
            el.find('div.pnl-pin-triggers').each(function () { this.dataBind(data); });
            if (typeof data.pin === 'undefined' || typeof data.pin.id === 'undefined' || data.pin.id === 0) {
                el.find('div.pin-definition').hide();
                el.find('div.select-pin-message').show();
                el.find('div.btn-panel').hide();
                el.find('div.pnl-pin-triggers').hide();
            }
            else {
                el.find('div.pin-definition').show();
                el.find('div.select-pin-message').hide();
                el.find('div.pnl-pin-triggers').show();
                el.find('div.btn-panel').show();
            }
            if (typeof data.pin === 'undefined' || !makeBool(data.pin.isExported)) {
                el.find('div.pin-state-panel').hide();
                el.find('div.pin-state-panel').show().find('div.picToggleButton').attr('data-gpioid', '');
            }
            else {
                console.log(data.pin.state);
                el.find('div.pin-state-panel').show().find('div.picToggleButton').attr('data-gpioid', data.pin.gpioId)[0].val((data.pin.state || { name: 'off' }).name);
            }
            if (typeof data.pin.gpioId !== 'undefined') el.find('div#divGPIOIdLine').show();
            else el.find('div#divGPIOLine').hide();
        }
    });
    $.widget('pic.pnlPinTriggers', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (data) { return self.dataBind(data); };
        },
        _createTriggerDialog: function (id, title, trig) {
            var self = this, o = self.options, el = self.element;
            var dlg = $.pic.modalDialog.createDialog(id, {
                width: '747px',
                height: 'auto',
                title: title,
                position: { my: "center top", at: "center top", of: window },
                buttons: [
                    {
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: function (evt) {
                            var trigger = dataBinder.fromElement(dlg);
                            if (dataBinder.checkRequired(dlg, true)) {
                                console.log(trigger);
                                $.putLocalService('/config/pin/trigger/' + trig.pin.headerId + '/' + trig.pin.id, trigger, 'Saving Trigger...', function (t, status, xhr) {
                                    dataBinder.bind(dlg, t);
                                    self.reloadTriggers();
                                });
                            }
                            //console.log(trigger);
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }
                ]
            });
            $('<div></div>').appendTo(dlg).text('A trigger is used to change the state of the selected pin.  You can add multiple triggers to a pin but the last trigger fired wins to control the pin.');
            $('<hr></hr>').appendTo(dlg);
            var line = $('<div></div>').appendTo(dlg);
            $('<input type="hidden"></input>').appendTo(dlg).attr('data-bind', 'id').attr('data-datatype', 'int');
            $('<div></div>').appendTo(line).pickList({
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Connection', binding: 'sourceId',
                columns: [{ hidden: true, binding: 'id', text: 'Id', style: { whiteSpace: 'nowrap' } }, { binding: 'name', text: 'Name', style: { minWidth: '197px' } }, { binding: 'type.desc', text: 'Type', style: { minWidth: '147px' } }],
                items: trig.connections, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
            })
                .on('selchanged', function (evt) {
                    dlg.find('div.pnl-trigger-params').each(function () { this.setConnection(evt.newItem); });
                });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Is Active', binding: 'isActive', value: true });
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).pickList({
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Desired State', binding: 'state.name',
                columns: [{ hidden: true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap', width:'77px' } }, { binding: 'desc', text: 'State', style: { minWidth: '77px' } }, { binding: 'inst', text: 'Description', style: { minWidth: '227px' } }],
                items: trig.triggerStates, inputAttrs: { style: { width: '3rem' } }, labelAttrs: { style: { width: '7rem' } }
            });
            $('<div></div>').appendTo(dlg).pnlTriggerParams({});
            if (typeof trig.trigger.id !== 'undefined') {
                dlg.find('div.pnl-trigger-params').each(function () {
                    var pnl = this;
                    this.dataBind(trig.trigger);
                });
                dataBinder.bind(dlg, trig.trigger);
            }
            dlg.css({ overflow: 'visible' });
            return dlg;
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-pin-triggers').addClass('list-outer');
            $('<div></div>').appendTo(el).crudList({
                id: 'crudTriggers',
                key: 'id',
                caption: 'Triggers', itemName: 'Pin Trigger',
                columns: [{ binding: 'state.desc', text: 'State', style: { width: '47px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, { binding: 'connection.name', text: 'Connection', style: { width: '157px' } }, { binding: 'eventName', text: 'Event', style: { width: '127px' } }, { binding: 'filter', text: 'Filter', style: { width: '247px' }, cellStyle: { fontSize: '8pt' } }]
            }).on('additem', function (evt) {
                var p = dataBinder.fromElement(el);
                $.getLocalService('/config/options/trigger/' + p.pin.headerId + '/' + p.pin.id + '/0', null, function (trig, status, xhr) {
                    trig.trigger.isActive = true;
                    self._createTriggerDialog('dlgAddPinTrigger', 'Add Trigger to Pin#' + trig.pin.id, trig);
                });
            }).on('edititem', function (evt) {
                var p = dataBinder.fromElement(el);
                $.getLocalService('/config/options/trigger/' + p.pin.headerId + '/' + p.pin.id + '/' + evt.dataKey, null, function (trig, status, xhr) {
                    var dlg = self._createTriggerDialog('dlgEditPinTrigger', 'Edit Trigger on Pin#' + trig.pin.id, trig);
                });
            }).on('removeitem', function (evt) {
                var p = dataBinder.fromElement(el);
                console.log(evt);
                $.pic.modalDialog.createConfirm('dlgConfirmDeleteTrigger', {
                    message: 'Are you sure you want to delete Pin Trigger?',
                    width: '350px',
                    height: 'auto',
                    title: 'Confirm Delete Trigger',
                    buttons: [{
                        text: 'Yes', icon: '<i class="fas fa-trash"></i>',
                        click: function () {
                            $.pic.modalDialog.closeDialog(this);
                            $.deleteLocalService('/config/pin/trigger/' + p.pin.headerId + '/' + p.pin.id + '/' + evt.dataKey, {}, 'Deleting Trigger...', function (c, status, xhr) {
                                self.loadTriggers(c.triggers);
                            });
                        }
                    },
                    {
                        text: 'No', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }]
                });
            });
            $('<div></div>').appendTo(el).addClass('pnl-pin-triggers-body');
            $('<input type="hidden"></input>').attr('data-bind', 'pin.headerId').appendTo(el).attr('data-datatype', 'int');;
            $('<input type="hidden"></input>').attr('data-bind', 'pin.id').appendTo(el).attr('data-datatype', 'int');

        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            dataBinder.bind(el, data);
            // Bind up the triggers.
            self.loadTriggers(data.pin.triggers);
        },
        reloadTriggers: function () {
            var self = this, o = self.options, el = self.element;
            var p = dataBinder.fromElement(el);
            $.getLocalService('/config/options/pin/' + p.pin.headerId + '/' + p.pin.id, null, function (opts, status, xhr) {
                self.loadTriggers(opts.pin.triggers);
            });
        },
        loadTriggers: function (triggers) {
            var self = this, o = self.options, el = self.element;
            el.find('div#crudTriggers').each(function () {
                this.clear();
                for (var i = 0; i < triggers.length; i++) {
                    this.addRow(triggers[i]);
                }
            });
        }
    });
    $.widget('pic.pnlConnections', {
        options: {cfg: {} },
        // The connections need to be thinks like
        // 1. Socket
        // 2. MQTT
        // 3. Http WebHook
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (conns) { self.dataBind(conns); }
        },
        _reloadConnections() {
            var self = this, o = self.options, el = self.element;
            $.getLocalService('/config/options/connections', null, function (conns, status, xhr) {
                console.log(conns);
                self.dataBind(conns.connections);
            });
        },
        _findServer: function (pnl, server) {
            var self = this, o = self.options, el = self.element;
            var srv = server;
            var dlg = $.pic.modalDialog.createDialog('dlgFindServers', {
                message: 'Searching for Servers',
                width: '400px',
                height: 'auto',
                title: 'Find Server',
                buttons: [{
                    text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                    click: function () { $.pic.modalDialog.closeDialog(this); }
                }]
            }).on('initdialog', function (evt) {
                console.log('open triggered');
                $.searchLocalService('/config/findServer', server, function (servers, status, xhr) {
                    console.log(server);
                    console.log(servers);
                    if (servers.length > 0) {
                        searchStatus.text(servers.length + ' Running ' + server.desc + ' server(s) found.');
                        for (var i = 0; i < servers.length; i++) {
                            var srv = servers[i];
                            var divSelection = $('<div></div>').addClass('picButton').addClass('server').addClass('btn').css({ maxWidth: '227px', height: '97px', verticalAlign: 'middle' }).appendTo(line);
                            if(server.desc.startsWith('nodejs'))
                                $('<div></div>').addClass('body-text').css({ textAlign: 'center' }).appendTo(divSelection).append('<i class="fab fa-node-js" style="font-size:30pt;color:green;vertical-align:middle;"></i>').append('<span style="vertical-align:middle;"> ' + server.desc + '</span>');
                            else
                                $('<div></div>').addClass('body-text').css({ textAlign: 'center' }).appendTo(divSelection).append('<i class="fas fa-server" style="font-size:30pt;color:lightseagreen;vertical-align:middle;"></i>').append('<span style="vertical-align:middle;"> ' + server.desc + '</span>');
                            $('<div></div>').css({ textAlign: 'center', marginLeft: '1rem', marginRight: '1rem' }).appendTo(divSelection).text(srv.origin);
                            divSelection.data('server');
                            divSelection.on('click', function (e) {
                                console.log(srv);
                                pnl.find('div[data-bind="ipAddress"]').each(function() { this.val(srv.hostname); });
                                pnl.find('div[data-bind="protocol"]').each(function () { this.val(srv.protocol) });
                                pnl.find('div[data-bind="port"]').each(function () { this.val(srv.port) });
                                //dataBinder.bind(divOuter, { services: { ip: server.hostname, port: server.port, protocol: server.protocol + '//' } });
                                $.pic.modalDialog.closeDialog(dlg[0]);
                            });
                        }
                    }
                    else {
                        searchStatus.text('No running ' + server.desc + ' servers could be found.');
                    }
                });
            });
            var found = $('<div></div>').appendTo(dlg).addClass('pnl-found-servers');
            var line = $('<div></div>').appendTo(found);
            var searchStatus = $('<div></div>').appendTo(line).css({ padding: '.5rem' }).addClass('status-text').addClass('picSearchStatus').text('Searching for running ' + server.desc + ' servers.');
            line = $('<div></div>').appendTo(found);
            $('<hr></hr>').appendTo(line);
            line = $('<div></div>').css({ textAlign: 'center' }).appendTo(found);
            dlg.css({ overflow: 'visible' });

        },
        _createConnectionDialog: function (id, title, conns) {
            var self = this, o = self.options, el = self.element;
            var dlg = $.pic.modalDialog.createDialog(id, {
                width: '570px',
                height: 'auto',
                title: title,
                buttons: [
                    {
                        id: 'btnFindServer',
                        hidden: true,
                        text: 'Find Server', icon: '<i class="fas fa-binoculars"></i>',
                        click: function (evt) {
                            var itm = dlg.find('div.picPickList[data-bind="type.name"]:first')[0].selectedItem();
                            self._findServer(dlg, { name: itm.name, desc: itm.desc, urn: itm.urn });
                        }
                    },
                    {
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: function () {
                            if (dataBinder.checkRequired(dlg, true)) {
                                var c = dataBinder.fromElement(dlg);
                                $.putLocalService('/config/connection', c, 'Saving Connection...', function (conn, status, xhr) {
                                    dataBinder.bind(dlg, conn);
                                    dlg.find('div[data-bind="type.name"]')[0].disabled(true);
                                    self._reloadConnections();
                                });
                            }
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }]
            });
            $('<div></div>').appendTo(dlg)
                .text('Connections are used to define triggers as inputs and calls for outputs.  Only active connections can communicate with the Equipment Manager.');
            $('<hr></hr>').appendTo(dlg);
            var line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).pickList({
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Conn Type', binding: 'type.name',
                columns: [{ hidden: true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }, { binding: 'desc', text: 'Type', style: { minWidth: '157px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' } }, { binding: 'inst', text: 'Description', style: { minWidth: '327px' } }],
                items: conns.connectionTypes, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '5.5rem' } }
            }).on('selchanged', function (e) {
                var c = dataBinder.fromElement(dlg);
                c.type = e.newItem;
                dlg.find('div.pnl-connection-type').each(function () { this.dataBind(c); });
                });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Is Active', binding: 'isActive' });
            line = $('<div></div>').appendTo(dlg);
            $('<input type="hidden"></input>').appendTo(line).attr('data-bind', 'id').attr('data-datatype', 'int');
            $('<div></div>').appendTo(line).inputField({ labelText: 'Name', binding: 'name', inputAttrs: { maxlength: 24 }, labelAttrs: { style: { width: '5.5rem' } } });
            $('<div></div>').appendTo(dlg).pnlConnectionType({ connectionTypes: conns.connectionTypes, connections: conns.connections });
            dlg.css({ overflow: 'visible' });
            return dlg;
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            $('<div></div>').appendTo(el).crudList({
                key: 'id',
                caption: 'Connections', itemName: 'Connection',
                columns: [{ binding: 'name', text: 'Name', style: { width: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, { binding: 'type.desc', text: 'Type', style: { width: '177px' } }]
            }).on('additem', function (evt) {
                $.getLocalService('/config/options/connections', null, function (conns, status, xhr) {
                    var dlg = self._createConnectionDialog('dlgAddConnection', 'Add a new Connection', conns);
                    dataBinder.bind(dlg, { isActive: true });
                });
            }).on('edititem', function (evt) {
                $.getLocalService('/config/options/connections/' + evt.dataKey, null, function (conns, status, xhr) {
                    var dlg = self._createConnectionDialog('dlgEditConnection', 'Edit a Connection', conns);
                    dataBinder.bind(dlg, conns.connection);
                    dlg.find('div[data-bind="type.name"]')[0].disabled(true);
                    dataBinder.bind(dlg, conns.connection);  // Bind it twice to make sure we have all the data.
                });
            }).on('removeitem', function (evt) {
                $.getLocalService('/config/options/connections/' + evt.dataKey, null, function (conns, status, xhr) {
                    $.pic.modalDialog.createConfirm('dlgConfirmConnection', {
                        message: '<div>Are you sure you want to delete Connection ' + conns.connection.name + '?</div><hr></hr><div><span style="color:red;font-weight:bold;">WARNING:</span> If you delete this connection it will remove all <span style="font-weight:bold;">triggers</span> associated with this connection.</div>',
                        width: '377px',
                        height: 'auto',
                        title: 'Confirm Delete Connection',
                        buttons: [{
                            text: 'Yes', icon: '<i class="fas fa-trash"></i>',
                            click: function () {
                                $.pic.modalDialog.closeDialog(this);
                                $.deleteLocalService('/config/options/connections/' + evt.dataKey, {}, 'Deleting Connection...', function (c, status, xhr) {
                                    evt.dataRow.remove();
                                });
                            }
                        },
                        {
                            text: 'No', icon: '<i class="far fa-window-close"></i>',
                            click: function () { $.pic.modalDialog.closeDialog(this); }
                        }]
                    });
                });
            });
        },
        dataBind: function (conns) {
            var self = this, o = self.options, el = self.element;
            var list = el.find('div.crud-list:first')[0];
            list.clear();
            for (var i = 0; i < conns.length; i++) {
                //console.log(conns[i]);
                list.addRow(conns[i]);
            }
        }
    });
    $.widget('pic.pnlConnectionType', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el[0].dataBind = function (conn) { self.dataBind(conn); }
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-connection-type');
        },
        _buildUriControls: function (type) {
            var self = this, o = self.options, el = self.element;
            var binding = '';
            var line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).pickList({
                labelText: 'Server', binding: binding + 'protocol', required: true,
                inputAttrs: { maxlength: 5 }, labelAttrs: { style: { width: '5.5rem' } },
                columns: [{ binding: 'val', hidden: true, text: 'Protocol', style: { whiteSpace: 'nowrap' } }, { binding: 'name', text: 'Protocol', style: { whiteSpace: 'nowrap', width:'4rem' } }, { binding: 'desc', text: 'Description', style: { minWidth: '300px' } }],
                bindColumn: 0, displayColumn: 1, items: [{ val: 'http:', name: 'http:', desc: 'The Equipment Manager is communicating without an SSL certificate' },
                { val: 'https:', name: 'https:', desc: 'The Equipment Manager is communicating using an SSL certificate.' }]
            });
            $('<div></div>').appendTo(line).inputField({ labelText: '', binding: binding + 'ipAddress', inputAttrs: { maxlength: 20 }, labelAttrs: { style: { width: '0px' } } });
            $('<div></div>').appendTo(line).inputField({ labelText: ':', dataType: 'int', binding: binding + 'port', inputAttrs: { maxlength: 7 }, labelAttrs: { style: { marginLeft: '.15rem', marginRigt: '.15rem' } } });
            line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).inputField({ labelText: 'User Name', binding: binding + 'userName', labelAttrs: { style: { width: '5.5rem' } }, inputAttrs: { maxlength: 20 } });
            line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).inputField({ labelText: 'Password', binding: binding + 'password', labelAttrs: { style: { width: '5.5rem' } }, inputAttrs: { maxlength: 20 } });
            $('<hr></hr').appendTo(el);
            line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).inputField({ labelText: 'Key File', binding: binding + 'sslKeyFile', labelAttrs: { style: { width: '5.5rem' } }, inputAttrs: { maxlength: 50 } });
            line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).inputField({ labelText: 'Cert File', binding: binding + 'sslCertFile', labelAttrs: { style: { width: '5.5rem' } }, inputAttrs: { maxlength: 50 } });
        },
        dataBind: function (conn) {
            var self = this, o = self.options, el = self.element;
            var connType = el.attr('data-conntype');
            console.log(conn);
            if (conn.type.name !== connType) {
                // We need to create the interface for the new connection type.
                el.empty();
                switch (conn.type.name) {
                    case 'njspc':
                    case 'webSocket':
                        self._buildUriControls(conn.type);
                        break;
                    case 'wsEndpoint':
                        break;
                    case 'wsClient':
                        self._buildUriControls(conn.type);
                        break;
                    case 'mqttBroker':
                        break;
                }
                if (typeof conn.type.urn !== 'undefined' && conn.type.urn) {
                    var btn = el.parents('div.ui-widget-content:first').find('#btnFindServer');
                    btn.attr('data-urn', conn.type.urn);
                    btn.show();
                }
                else 
                    el.parents('div.ui-widget-content:first').find('#btnFindServer').hide();
            }
            dataBinder.bind(el, conn);
            el.attr('data-conntype', conn.type);
        }
    });
    $.widget('pic.pnlTriggerParams', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].setConnection = function (conn) { self.setConnection(conn); };
            el[0].dataBind = function (data) { self.dataBind(data); };
            el[0].setTrigger = function (data) { self.setTrigger(data); };
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-trigger-params');
        },
        setTrigger: function () {

        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            self.setConnection(data.connection, function () {
                if (typeof data.eventName !== 'undefined') {
                    var fldEventName = el.find('div[data-bind$="eventName"');
                    if (fldEventName[0].val() !== data.eventName) {
                        fldEventName[0].val(data.eventName);
                        dataBinder.bind(el, data);
                    }
                }
                else {
                    dataBinder.bind(el, data);
                }
            });
        },
        setConnection: function (conn, callback) {
            var self = this, o = self.options, el = self.element;
            let type = typeof conn !== 'undefined' && typeof conn.type !== 'undefined' && conn.id > 0 ? conn.type.name : '';
            if (el.attr('data-conntype') !== type || type === '') {
                el.attr('data-conntype', type);
                el.empty();
                o.bindings = undefined;
                if (type !== '') {
                    $.searchLocalService('/config/connection/bindings', { name: type }, 'Getting Connection Bindings...', function (bindings, status, xhr) {
                        o.bindings = bindings;
                        var line = $('<div></div>').appendTo(el);
                        if (typeof o.bindings.events !== 'undefined' && o.bindings.events.length > 1) {
                            $('<div></div>').appendTo(line).pickList({
                                required: true,
                                bindColumn: 0, displayColumn: 0, labelText: 'Event Name', binding: 'eventName',
                                columns: [{ binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }],
                                items: bindings.events, inputAttrs: { style: { width: '7rem' } }, labelAttrs: { style: { width: '7rem' } }
                            })
                                .on('selchanged', function (evt) {
                                    var itm = o.bindings.events.find(elem => elem.name === evt.newItem.name);
                                    self._build_bindings(itm);
                                });
                        }
                        else {
                            $('<div></div>').appendTo(line).inputField({
                                required: true, binding: 'eventName', labelText: "Event Name", inputAttrs: { style: { width: '7rem' } }, labelAttrs: { style: { width: '7rem' } }
                            });
                        }
                        $('<hr></hr>').appendTo(el);
                        var tabBar = $('<div></div>').appendTo(el).tabBar();
                        {
                            // Add in the basic bindings.
                            var basic = tabBar[0].addTab({ id: 'tabBasic', text: 'Basic Bindings' });
                            var pnl = $('<div></div>').addClass('pnl-trigger-basic-bindings').appendTo(basic);
                        }
                        {
                            var advanced = tabBar[0].addTab({ id: 'tabAdvanced', text: 'Filter Expression' });
                            var pnl = $('<div></div>').addClass('pnl-trigger-advanced-bindings').appendTo(advanced);
                            $('<div></div>').appendTo(pnl).addClass('trigger-advanced-instructions').html('Enter plain javascript for the filter expression below.  If you do not want to filter this trigger, then leave the expression blank.  Each of the parameter inputs (connection, trigger, pin, and data) are available within the filter function.  To view their available properties click on the parameter to see it\'s definition.  Use return <span style=\"font-weight:bold;\">true.</span> from the filter function to apply the trigger state.');
                            $('<div></div>').appendTo(pnl).scriptEditor({ binding: 'expression', prefix: '(connection, trigger, pin, data) => {', suffix: '}', codeStyle: { maxHeight: '300px', overflow: 'auto' } });
                        }
                        if (typeof o.bindings.events === 'undefined' || o.bindings.events.length === 0) {
                            self._build_bindings({ bindings: [], useExpression: true });
                            tabBar.show();
                        }
                        else tabBar.hide();
                        if (typeof callback === 'function') { callback(); }
                    });
                }
                else if (typeof callback === 'function') { callback(); }
            }
            else if (typeof callback === 'function') { callback(); }
        },
        _build_njsPC: function (conn, callback) {
            var self = this, o = self.options, el = self.element;
            $.searchLocalService('/config/connection/bindings', { name: 'njspc' }, function (bindings, status, xhr) {
                //console.log(bindings);
                o.bindings = bindings;
                var line = $('<div></div>').appendTo(el);
                $('<div id="divBindingInstructions"></div>').appendTo(el).addClass('pnl-pin-binding-instructions').hide();
                line = $('<div></div>').appendTo(el);
                $('<div></div>').appendTo(line).pickList({
                    required: true,
                    bindColumn: 0, displayColumn: 0, labelText: 'Event Name', binding: 'eventName',
                    columns: [{ binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }],
                    items: bindings.events, inputAttrs: { style: { width: '7rem' } }, labelAttrs: { style: { width: '7rem' } }
                })
                    .on('selchanged', function (evt) {
                        var itm = o.bindings.events.find(elem => elem.name === evt.newItem.name);
                        var fldId = el.find('div#fldEquipmentId');
                        var ddEventBinding = el.find('div#ddEventBinding');
                        var ddEventOperator = el.find('div#ddEventOperator');
                        var valType = ddEventBinding.attr('valtype') || 'none';
                        o.boundEvent = itm;
                        if (itm.hasId) {
                            fldId.show();
                        }
                        else {
                            fldId.hide();
                        }
                        ddEventBinding.show();
                        ddEventOperator.show();
                        console.log(itm.bindings);
                        ddEventBinding[0].items(itm.bindings);
                        ddEventBinding[0].val(itm.bindings[0].binding);
                        var divInst = el.find('div#divBindingInstructions');
                        if (typeof o.boundEvent.instructions !== 'undefined' && o.boundEvent.instructions !== '') {
                            divInst.html(o.boundEvent.instructions);
                            divInst.show();
                        }
                        else {
                            divInst.html('');
                            divInst.hide();
                        }
                    });
                $('<div></div>').appendTo(line).inputField({
                    id:'fldEquipmentId', labelText: 'Id', binding: 'equipmentId', dataType:'int',
                    inputAttrs: { style: { width: '4rem' } }, labelAttrs: { style: { paddingLeft: '1rem' } }
                }).hide();
                line = $('<div></div>').appendTo(el);
                $('<div></div>').appendTo(line).pickList({
                    required: true, id: 'ddEventBinding',
                    bindColumn: 0, displayColumn: 0, labelText: 'Binding', binding: 'binding',
                    columns: [{ binding: 'binding', text: 'Name', style: { whiteSpace: 'nowrap' } }],
                    items: [], inputAttrs: { style: { width: '7rem' } }, labelAttrs: { style: { width: '7rem' } }
                }).on('selchanged', function (evt) {
                    var event = o.boundEvent;
                    var fldId = el.find('div#fldEquipmentId');
                    var ddEventBinding = el.find('div#ddEventBinding');
                    var ddEventOperator = el.find('div#ddEventOperator');
                    var fldValue = el.find('div#fldValue');
                    var ddValue = el.find('div#ddValue');
                    //console.log(evt.newItem);
                    var dataType = o.bindings.dataTypes[evt.newItem.type];

                    // Create our array of operators.
                    var ops = [];
                    for (var i = 0; i < dataType.operators.length; i++) {
                        var op = dataType.operators[i];
                        var t = o.bindings.operatorTypes.find(elem => elem.name === op);
                        if (typeof t !== 'undefined') ops.push(t);
                    }
                    ddEventOperator[0].items(ops);
                    var valType = (typeof dataType.values === 'undefined' || dataType.values === 'undefined') ? 'field' : 'dropdown';
                    //console.log({ dataType:dataType, event: event, ops: ops, valType: valType, newItem: evt.newItem, bindings: o.bindings });
                    switch (valType) {
                        case 'field':
                            fldValue.show();
                            ddValue.hide();
                            fldValue.attr('data-bind', 'bindValue');
                            ddValue.attr('data-bind', '');
                            fldValue[0].required(true);
                            ddValue[0].required(false);
                            break;
                        case 'dropdown':
                            fldValue.hide();
                            ddValue.show();
                            fldValue.attr('data-bind', '');
                            ddValue.attr('data-bind', 'bindValue');
                            fldValue[0].required(false);
                            ddValue[0].required(true);
                            ddValue[0].items(dataType.values);
                            break;
                    }
                   
                }).hide();
                $('<div></div>').appendTo(line).pickList({
                    required: true, id: 'ddEventOperator',
                    bindColumn: 0, displayColumn: 1, labelText: 'Operator', binding: 'operator',
                    columns: [{ hidden:true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }, { binding: 'op', text: 'Operator', style: { textAlign:'center', whiteSpace: 'nowrap' } }, { binding: 'desc', text: 'Description', style: {} }],
                    items: [], inputAttrs: { style: { textAlign:'center', width: '3rem' } }, labelAttrs: { style: { paddingLeft: '.1rem', display:'none' } }
                }).hide();
                $('<div></div>').appendTo(line).pickList({
                    required: true, id: 'ddValue',
                    bindColumn: 0, displayColumn: 1, labelText: 'Value', binding: '',
                    columns: [{ hidden:true, binding: 'val', text: 'Value', style: { whiteSpace: 'nowrap' } }, { binding: 'name', text: 'Value', style: {} }],
                    items: [], inputAttrs: { style: { width: '3rem' } }, labelAttrs: { style: { paddingLeft: '.1rem', display:'none' } }
                }).hide();
                $('<div></div>').appendTo(line).inputField({
                    required: true, id: 'fldValue', labelText: 'Id', binding: '', 
                    inputAttrs: { style: { width: '4rem' } }, labelAttrs: { style: { paddingLeft: '.1rem', display:'none' } }
                }).hide();
                if (typeof callback === 'function') { console.log('Calling back from build'); callback(); }
            });
        },
        //_build_webSocket: function (conn) {
        //    var self = this, o = self.options, el = self.element;
        //    var line = $('<div></div>').appendTo(el);
        //    $('<div></div>').appendTo(line).inputField({
        //        labelText: 'Event Name', binding:'eventName', required: true, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
        //    });
        //    line = $('<div></div>').appendTo(el);
        //    $('<div></div>').appendTo(line).scriptEditor({ binding:'expression', prefix:'(connection, trigger, pin, data) => {', suffix:'}', codeStyle: { maxHeight: '300px', overflow: 'auto' } });
        //    if (typeof callback === 'function') { console.log('Calling back from build'); callback(); }
        //},
        _build_wsEndpoint: function (conn) {
            var self = this, o = self.options, el = self.element;

        },
        _build_wsClient: function (conn) {
            var self = this, o = self.options, el = self.element;

        },
        _build_bindings: function (event) {
            var self = this, o = self.options, el = self.element;
            var basic = el.find('div.pnl-trigger-basic-bindings');
            var tabBar = el.find('div.picTabBar:first');
            basic.empty();
            if (typeof event !== 'undefined' && event.bindings.length > 0) {
                self._build_basicBindings(event);
            }
            tabBar[0].showTab('tabBasic', typeof event !== 'undefined' && event.bindings.length > 0);
            tabBar[0].showTab('tabAdvanced', o.bindings.useExpression !== false);
            typeof event !== 'undefined' && event.bindings.length === 0 ? tabBar[0].selectTabById('tabAdvanced') : tabBar[0].selectTabById('tabBasic');
            tabBar.show();
        },
        _build_basicBindings: function (event) {
            var self = this, o = self.options, el = self.element;
            var div = el.find('div.pnl-trigger-basic-bindings');
            let inst = $('<div></div>').addClass('trigger-basic-instructions').appendTo(div).html('<div>Click the checkbox next to the filter binding to enable the expression for the data.  For more advanced filters add script on the Filter Expression tab.  If you supply filters here these will be checked prior to evaluating the filter expression.</div>');
            if (typeof event.instructions !== 'undefined' && event.instructions !== '') {
                $('<hr></hr>').appendTo(inst);
                $('<div></div>').appendTo(inst).html(event.instructions);
            }
            var line = $('<div></div>').appendTo(div);
            //console.log({ msg: 'Building event bindings', event: event });
            var pinId = $('<div></div>').appendTo(line).checkbox({ labelText: 'Use Pin Id', bind: 'usePinId', });
            if (!makeBool(event.hasPinId)) pinId.hide();
            for (var i = 0; i < event.bindings.length; i++) {
                var bind = event.bindings[i];
                //console.log({ msg: 'Event Binding', bind: bind });
                var binding = 'bindings[' + i + ']';
                var dataType = o.bindings.dataTypes[bind.type];
                var ops = [];
                for (var j = 0; j < dataType.operators.length; j++) {
                    var op = dataType.operators[j];
                    var t = o.bindings.operatorTypes.find(elem => elem.name === op);
                    if (typeof t !== 'undefined') ops.push(t);
                }
                line = $('<div></div>').addClass('trigger-binding').attr('data-bindingname', bind.binding).appendTo(div);
                $('<input type="hidden"></input>').appendTo(line).attr('data-bind', binding + '.binding').val(bind.binding);
                $('<div></div>').appendTo(line).checkbox({ labelText: bind.binding, bind: binding + '.isActive', style: { width: '7rem' } }).on('changed', function (evt) {
                    var l = $(evt.target).parent();
                    var ddOp = l.find('div[data-bind$=".operator"]');
                    var fld = l.find('div[data-bind$=".bindValue"]');
                    //console.log(evt);
                    if (evt.newVal) {
                        ddOp.show();
                        fld.show();
                    }
                    else {
                        ddOp.hide();
                        fld.hide();
                    }
                    ddOp[0].required(evt.newVal);
                    fld[0].required(evt.newVal);
                });
                $('<div></div>').appendTo(line).pickList({
                    bindColumn: 0, displayColumn: 1, labelText: 'Operator', binding: binding + '.operator',
                    columns: [{ hidden: true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }, { binding: 'op', text: 'Operator', style: { textAlign: 'center', whiteSpace: 'nowrap', minWidth: '4rem' } }, { binding: 'desc', text: 'Description', style: { minWidth: '12rem' } }],
                    items: ops, inputAttrs: { style: { textAlign: 'center', width: '3rem' } }, labelAttrs: { style: { paddingLeft: '.1rem', display: 'none' } }
                }).addClass('trigger-binding-operator').hide();
                switch (bind.type) {
                    case 'boolean':
                        $('<div></div>').appendTo(line).pickList({
                            id: 'ddValue', dataType:bind.type,
                            bindColumn: 0, displayColumn: 1, labelText: 'Value', binding: binding + '.bindValue',
                            columns: [{ hidden: true, binding: 'val', text: 'Value', style: { whiteSpace: 'nowrap' } }, { binding: 'name', text: 'Value', style: {} }],
                            items: [{ val: true, name: 'True' }, { val: false, name: 'False' }], inputAttrs: { style: { width: '3rem' } }, labelAttrs: { style: { paddingLeft: '.1rem', display: 'none' } }
                        }).hide();
                        break;
                    default:
                        $('<div></div>').appendTo(line).inputField({
                            id: 'fldValue', labelText: 'Id', binding: binding + '.bindValue', dataType: bind.type,
                            inputAttrs: { style: bind.inputStyle }, labelAttrs: { style: { paddingLeft: '.1rem', display: 'none' } }
                        }).hide();
                        break;
                }
            }
            return div;
        }
    });
})(jQuery);
