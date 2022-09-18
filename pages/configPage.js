(function ($) {
    $.widget('pic.configPage', {
        options: { cfg: {} },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].boardType = function (val) { return typeof val === 'undefined' ? o.boardType : o.boardType = val; };
            el[0].interfaces = function (val) { return typeof val === 'undefined' ? o.interfaces : o.interfaces = val; };
            el[0].removeTab = function (tabId) { el.find(`div.picTabPanel[id$=tabsMain]`).each(function () { this.removeTab(tabId); }); };
            el[0].addTab = function (tab) { self._addConfigTab(tab); };
            console.log({ msg: 'Building', opts: o });
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
                case 'tabSpi0':
                    evt.newTab.contents.empty();
                    $('<div></div>').appendTo(evt.newTab.contents).pnlCfgSpi({ controllerId: 0 });
                    break;
                case 'tabSpi1':
                    evt.newTab.contents.empty();
                    $('<div></div>').appendTo(evt.newTab.contents).pnlCfgSpi({ controllerId: 1 });
                    break;
                case 'tabGenericDevices':
                    evt.newTab.contents.empty();
                    $('<div></div>').appendTo(evt.newTab.contents).pnlCfgGenericDevices();
                    break;
                default:
                    evt.newTab.contents.empty();
                    if (evt.newTab.id.startsWith('tabI2c')) {
                        $('<div></div>').appendTo(evt.newTab.contents).pnlI2cBus({ busNumber: parseInt(evt.newTab.id.replace('tabI2c', ''), 10) });

                    }
                    if (evt.newTab.id.startsWith('tabOneWire')) {
                        $('<div></div>').appendTo(evt.newTab.contents).pnlOneWireBus({ busNumber: parseInt(evt.newTab.id.replace('tabOneWire', ''), 10) });

                    }
                    break;
            }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            var tabs = $('<div class="picTabPanel"></div>').attr('id', 'tabsMain');
            el.addClass('pnl-board-definition');
            tabs.appendTo(el);
            tabs.tabBar();
            tabs.find('div.picTabContents').addClass('picConfigTabContents');
            tabs.on('tabchange', function (evt) { self._onTabChanged(evt); });
            var evt = $.Event('loaded');
            var tab;
            tab = self._addConfigTab({ id: 'tabGeneral', text: 'General', cssClass: 'cfgGeneral' });
            tab = self._addConfigTab({ id: 'tabGpio', text: 'GPIO - Pinouts', cssClass: 'cfgGpio' });
            tab = self._addConfigTab({ id: 'tabSpi0', text: 'SPI0 - Devices', cssClass: 'cfgSpi0' });
            tab = self._addConfigTab({ id: 'tabSpi1', text: 'SPI1 - Devices', cssClass: 'cfgSpi1' });
            tab = self._addConfigTab({ id: 'tabGenericDevices', text: 'Generic Devices', cssClass: 'cfgGenericDevices' });
            tabs[0].showTab('tabSpi0', false);
            tabs[0].showTab('tabSpi1', false);
            tabs[0].selectTabById('tabGeneral');
            tabs.on('tabchange', function (evt) {
                if (typeof evt.oldTab === 'undefined' || evt.oldTab.id === evt.newTab.id) return;
                var interfaces = o.interfaces || {};
                var btype = o.boardType || { name: 'unknown' };
                if (typeof evt.oldTab !== 'undefined') {
                    var contents = typeof evt.oldTab.contents !== 'undefined' ? evt.oldTab.contents : $('<div></div>');
                    pnl = contents.children('div:first')[0];
                    // Check to see if the user changed the controller type.
                    if (typeof pnl.checkChanged === 'function' && !pnl.checkChanged()) evt.preventDefault();
                }
                //evt.preventDefault();
            });
            self._initServices();
            $.getLocalService('/config/options/i2c', null, function (i2c, status, xhr) {
                for (var i = 0; i < i2c.buses.length; i++) {
                    var bus = i2c.buses[i];
                    self._addConfigTab({ id: 'tabI2c' + bus.busNumber, text: 'I<span style="vertical-align:super;font-size:.7em;display:inline-block;margin-top:-20px;">2</span>C - Bus #' + bus.busNumber });
                }
            });
            $.getLocalService('/config/options/oneWire', null, function (oneWire, status, xhr) {
                for (var i = 0; i < oneWire.buses.length; i++) {
                    var bus = oneWire.buses[i];
                    self._addConfigTab({ id: 'tabOneWire' + bus.busNumber, text: '1-Wire - Bus #' + bus.busNumber });
                }
            });
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
        setConnected: function (connected) {
            var overlay = $('div[id=connectOverlay]');
            if (connected === true && overlay.length > 0) overlay.remove();
            else if (!connected && overlay.length === 0) {
                overlay = $('<div id="connectOverlay" style="background-color:lavender;opacity:.4;z-index:501"></div>').addClass('ui-widget-overlay').addClass('ui-front').appendTo(document.body);
            }
        },
        _initServices: function () {
            var self = this, o = self.options, el = self.element;
            o.socket = io('/', { reconnectionDelay: 2000, reconnection: true, reconnectionDelayMax: 20000 });
            o.socket.on('gpioPin', (data) => {
                console.log({ evt: 'gpioPin', data: data });
                el.find('div.pin-header[data-id="' + data.headerId + '"]')
                    .find('div.header-pin[data-id="' + data.pinId + '"]')
                    .each(function () { this.state(data.state); });
                el.find('div#btnPinState[data-gpioid="' + data.gpioId + '"]').each(function () { this.val(makeBool(data.state)); });
            });
            o.socket.on('spiChannel', (data) => {
                //console.log({ evt: 'spiChannel', data: data });
                el.find('div.pnl-config-spi[data-controllerid=' + data.bus + ']').each(function () { this.setChannelValue(data); });
            });
            o.socket.on('i2cDataValues', function (data) {
                el.find(`.pnl-i2c-device[data-address="${data.address}"][data-busnumber="${data.bus}"] .i2cReadingValues`).each(function () {
                    console.log({ evt: 'i2cDataValues', data: data, control: this });
                    dataBinder.bind($(this), data);
                });
            });
            o.socket.on('i2cDeviceStatus', function (data) {
                el.find(`.pnl-i2c-device[data-address="${data.address}"][data-busnumber="${data.bus}"] .i2cReadingValues`).each(function () {
                    console.log({ evt: 'i2cDeviceStatus', data: data, control: this });
                    this.setStatus(data);
                });
                
            });
            o.socket.on('i2cDeviceInformation', function (data) {
                //console.log({ evt: 'i2cDeviceInformation', data: data });
                el.find(`.pnl-i2c-device[data-address="${data.address}"][data-busnumber="${data.bus}"] .i2cDeviceInformation`).each(function () {
                    console.log({ evt: 'i2cDeviceInformation', data: data, control: this });
                    dataBinder.bind($(this), data);
                });
                
            });
            o.socket.on('oneWireDataValues', function (data) {
                el.find(`.pnl-oneWire-device[data-address="${data.address}"][data-busnumber="${data.bus}"] .oneWireReadingValues`).each(function () {
                    console.log({ evt: 'oneWireDataValues', data: data, control: this });
                    dataBinder.bind($(this), data);
                });
            });
            o.socket.on('oneWireDeviceStatus', function (data) {
                el.find(`.pnl-oneWire-device[data-address="${data.address}"][data-busnumber="${data.bus}"] .oneWireReadingValues`).each(function () {
                    console.log({ evt: 'oneWireDeviceStatus', data: data, control: this });
                    this.setStatus(data);
                });
                
            });
            o.socket.on('oneWireDeviceInformation', function (data) {
                //console.log({ evt: 'oneWireDeviceInformation', data: data });
                el.find(`.pnl-oneWire-device[data-address="${data.address}"][data-busnumber="${data.bus}"] .oneWireDeviceInformation`).each(function () {
                    console.log({ evt: 'oneWireDeviceInformation', data: data, control: this });
                    dataBinder.bind($(this), data);
                });
                
            });
            o.socket.on('genericDataValues', function (data) {
                el.find(`.pnl-generic-device-details[data-id="${data.id}"][data-typeId=${data.typeId}] .genericReadingValues`).each(function () {
                    console.log({ evt: 'genericDataValues', data: data, control: this });
                    dataBinder.bind($(this), data);
                });
            });
            o.socket.on('connect_error', function (data) {
                console.log('connection error:' + data);
                o.isConnected = false;
                $('div.picController').each(function () {
                    this.setConnectionError({ status: { val: 255, name: 'error', desc: 'Connection Error' } });
                });
                self.setConnected(false);
                //el.addClass('picDisconnected');
                //el.find('div.dashContainer').each(function () {
                //    $(this).addClass('picDisconnected');
                //});
                el.find(`.pnl-i2c-device`).each(function () {
                    this.setConnected(false);
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
                $.getLocalService(`/devices/state`, null, 'Loading Socket Data...', function (data, status, xhr) {
                    console.log(data);
                });
                self.setConnected(true);
                //el.removeClass('picDisconnected');
                //el.find('div.dashContainer').each(function () {
                //    $(this).removeClass('picDisconnected');
                //});
                el.find(`.pnl-i2c-device`).each(function () {
                    this.setConnected(true);
                });

            });
            o.socket.on('close', function (sock) {
                console.log({ msg: 'socket closed:', sock: sock });
                o.isConnected = false;
            });
        }
    });

})(jQuery);
