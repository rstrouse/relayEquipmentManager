(function ($) {
    $.widget('pic.pnlCfgI2c', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-config-i2c');
            el.attr('data-controllerid', o.controllerId);
            $.getLocalService('/config/options/i2c', null, function (data, status, xhr) {
                console.log(data);

            });
        },
        dataBind: function (i2c) {
            var self = this, o = self.options, el = self.element;
            dataBinder.bind(el, data);
        }
    });
    $.widget('pic.pnlI2cBus', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (data) { return self.dataBind(data); };
            el[0].val = function (val) { return self.val(val); }
            el[0].loadDevices = function (selAddr) { return self.loadDevices(selAddr); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-i2c-bus');
            el.attr('data-busid', o.busId);
            var divList = $('<div></div>').appendTo(el);
            var divDevice = $('<div></div>').appendTo(el);
            $.getLocalService('/config/options/i2c/' + o.busId, null, function (i2cBus, status, xhr) {
                console.log(i2cBus);
                $('<div></div>').appendTo(divList).selectList({
                    id: 'i2cAddresses',
                    key: 'address',
                    caption: 'Devices', itemName: 'Device',
                    columns: [{ binding: 'addressName', text: 'Address', style: { width: '87px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' } },
                    { binding: 'name', text: 'Name', style: { width: '197px' } }]
                }).on('selected', function (evt) {
                    console.log(evt);
                    divDevice.empty();
                    $('<div></div>').appendTo(divDevice).pnlI2cDevice({ busId: o.busId, busNumber: i2cBus.bus.busNumber, address: evt.dataKey });
                });
                    //.css({ fontSize: '8pt' });
                self.dataBind(i2cBus);
            });

        },
        loadDevices: function (selAddr) {
            var self = this, o = self.options, el = self.element;
            $.getLocalService('/config/options/i2c/' + o.busId, null, function (i2cBus, status, xhr) {
                self.dataBind(i2cBus, selAddr);
            });
        },
        dataBind: function (data, selAddr) {
            var self = this, o = self.options, el = self.element;

            var addrs = data.bus.addresses.slice();
            for (var i = 0; i < data.bus.devices.length; i++) {
                var dev = data.bus.devices[i];
                var addr = addrs.find(elem => elem.address === dev.address);
                if (typeof addr === 'undefined') {
                    addrs.push({ address: dev.address, id: dev.id, manufacturer: 0, product: 0, name: 'Unknown' });
                }
            }
            addrs.sort((a, b) => { return a.address - b.ddress });
            el.find('div#i2cAddresses').each(function () {
                this.clear();
                for (var n = 0; n < addrs.length; n++) {
                    addrs[n].addressName = `${addrs[n].address.toString()} - 0x${addrs[n].address.toString(16).padStart(2, '0')}`;
                    var r = this.addRow(addrs[n]);
                    if (typeof selAddr !== 'undefined' && selAddr === addrs[n].address) r.addClass('selected');
                }
            });
           
        },
    });
    $.widget('pic.pnlI2cDevice', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (data) { return self.dataBind(data); };
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-i2c-device');
            el.attr('data-bindingcontext', 'device');
            $('<input type="hidden"></input>').appendTo(el).attr('data-bind', "busNumber").attr('data-datatype', 'int').text(o.busNumber);
            $('<input type="hidden"></input>').appendTo(el).attr('data-bind', "busId").attr('data-datatype', 'int').text(o.busId);
            $('<input type="hidden"></input>').appendTo(el).attr('data-bind', "address").attr('data-datatype', 'int').text(o.address);
            $('<input type="hidden"></input>').appendTo(el).attr('data-bind', "id").attr('data-datatype', 'int');
            el.attr('data-busnumber', o.busNumber);
            el.attr('data-address', o.address);
            var outer = $('<div></div>').appendTo(el).addClass('control-panel');
            var head = $('<div></div>').appendTo(outer).addClass('pnl-settings-header').addClass('control-panel-title');
            $('<span></span>').appendTo(head).addClass('header-text').html(`I<span style="vertical-align:super;font-size:.7em;display:inline-block;margin-top:-20px;">2</span>C Device Definition for Address ${o.address} - 0x${o.address.toString(16).padStart(2, '0')}`);
            var pnl = $('<div></div>').appendTo(outer);
            $.getLocalService('/config/options/i2c/' + o.busId + '/' + o.address, null, function (i2cDevice, status, xhr) {
                console.log(i2cDevice);
                var binding = '';
                var line = $('<div></div>').appendTo(pnl);
                o.deviceTypes = i2cDevice.deviceTypes;
                $('<div></div>').appendTo(line).checkbox({ binding: binding + 'isActive', labelText: 'Is Active', style: {} }).on('changed', function (evt) {
                    //acc[0].columns()[0].elGlyph().attr('class', evt.newVal ? 'fas fa-share-alt' : 'fas fa-share-alt').css({ textShadow: evt.newVal ? '0px 0px 3px green' : '', color: evt.newVal ? 'darkGreen' : '' });
                });
                $('<div></div>').appendTo(line).pickList({
                    binding: binding + 'typeId', labelText: 'Device',
                    bindColumn: 0, displayColumn: 1,
                    columns: [{ hidden: true, binding: 'id', text: 'Id', style: { whiteSpace: 'nowrap' } }, { hidden: false, binding: 'name', text: 'Device Name', style: { whiteSpace: 'nowrap' } }, { hidden: false, binding: 'category', text: 'Category', style: { whiteSpace: 'nowrap' } }],
                    items: i2cDevice.deviceTypes, inputAttrs: { style: { width: '14rem' } }, labelAttrs: { style: { marginLeft: '1rem' } }
                }).on('selchanged', function (evt) {
                    self.createDeviceOptions(evt.newItem);
                });
                $('<div></div>').appendTo(line).valueSpinner({ required: true, binding: binding + 'sampling', labelText: 'Sampling', min: 1, max: 100, labelAttrs: { style: { width: '5rem' } } });
                var dt = o.deviceTypes.find(elem => elem.id === i2cDevice.device.typeId);
                var tabBar = $('<div></div>').appendTo(pnl).tabBar().on('tabchange', function (evt) {
                    evt.stopPropagation();
                }).hide();
                $('<div></div>').appendTo(tabBar[0].addTab({ id: 'tabOptions', text: 'Device Options' })).pnlI2cOptions();
                $('<div></div>').appendTo(tabBar[0].addTab({ id: 'tabTriggers', text: 'Triggers' })).pnlI2cTriggers();
                $('<div></div>').appendTo(tabBar[0].addTab({ id: 'tabFeeds', text: 'Feeds' })).pnlI2cFeeds();
                tabBar[0].selectTabById('tabOptions');
                if (typeof dt !== 'undefined') self.createDeviceOptions(dt);
                i2cDevice.device.busNumber = o.busNumber;
                i2cDevice.device.address = o.address;
                i2cDevice.device.busId = o.busId;
                self.dataBind(i2cDevice.device);
            });
            var btnPnl = $('<div class="btn-panel"></div>').appendTo(outer);
            $('<div></div>').appendTo(btnPnl).actionButton({ text: 'Save Device', icon: '<i class="fas fa-save"></i>' })
                .on('click', function (evt) { self.saveDevice(); });
            $('<div></div>').appendTo(btnPnl).actionButton({id: "btnDeleteDevice", text: 'Delete Device', icon: '<i class="fas fa-trash"></i>' })
                .on('click', function (evt) { self.deleteDevice(); });
        },
        saveDevice: function () {
            var self = this, o = self.options, el = self.element;
            if (dataBinder.checkRequired(el)) {
                var dev = dataBinder.fromElement(el);
                dev.busId = o.busId;
                dev.busNumber = o.busNumber;
                dev.address = o.address;
                console.log(dev);
                if (isNaN(dev.id)) delete dev.id;
                $.putLocalService('/config/i2c/device', dev, 'Saving I2c Device...', function (i2cDev, status, xhr) {
                    self.dataBind(i2cDev);
                    el.parents('div.pnl-i2c-bus:first')[0].loadDevices(dev.address);
                });
            }
        },
        deleteDevice: function () {
            var self = this, o = self.options, el = self.element;
            var dev = dataBinder.fromElement(el);
            $.pic.modalDialog.createConfirm('dlgConfirmDeleteDevice', {
                message: `Are you sure you want to delete device from address ${dev.address}?`,
                width: '350px',
                height: 'auto',
                title: 'Confirm Delete Device',
                buttons: [{
                    text: 'Yes', icon: '<i class="fas fa-trash"></i>',
                    click: function (evt) {
                        $.deleteLocalService('/config/i2c/device', dev, 'Deleting I2c Device...', function(i2cDev, status, xhr) {
                            self.dataBind({ id:'', busId: dev.busId, busNumber: dev.busNumber, address: dev.address, isActive: false, typeId: 0 });
                            el.parents('div.pnl-i2c-bus:first')[0].loadDevices(dev.address);
                        });
                        $.pic.modalDialog.closeDialog(this);
                    }
                },
                {
                    text: 'No', icon: '<i class="far fa-window-close"></i>',
                    click: function () { $.pic.modalDialog.closeDialog(this); }
                }]
            });

        },
        createDeviceOptions: function (dev) {
            var self = this, o = self.options, el = self.element;
            if (el.attr('data-typeid') !== dev.id.toString()) {
                el.attr('data-typeid', dev.id);
                var pnl = el.find('div.pnl-i2cdevice-options:first');
                pnl.empty();
            }
        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            var tabs = el.find('div.picTabBar:first');
            var dt = o.deviceTypes.find(elem => elem.id === data.typeId);
            if (typeof data.typeId !== 'number' || typeof dt === 'undefined') {
                tabs.hide();
                el.find('div.picActionButton#btnDeleteDevice').hide();
                el.find('div.picPickList[data-bind="typeId"]').each(function () { this.disabled(false); });
            }
            else {
                tabs.show();
                el.find('div.picActionButton#btnDeleteDevice').show();
                el.find('div.picPickList[data-bind="typeId"]').each(function () { this.disabled(true); });
            }
            var pnlOpts = el.find('div.i2cdevice-options');
            pnlOpts[0].setDeviceType(dt, data);
            console.log(data);
            dataBinder.bind(el, data);
        },
    });
    $.widget('pic.pnlI2cOptions', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('i2cdevice-options');
            el[0].setDeviceType = function (dt) { self.setDeviceType(dt); }
        },
        setDeviceType: function (dt, device) {
            var self = this, o = self.options, el = self.element;
            self.createDeviceOptions(dt, device);
        },
        createDeviceOptions: function (devType, data) {
            var self = this, o = self.options, el = self.element;
            var pnl = el;
            if (typeof devType !== 'undefined' && typeof devType.options !== 'undefined') {
                var binding = 'options';
                if (pnl.attr('data-devicetypeid') !== devType.id.toString()) {
                    pnl.empty();
                    //console.log(`Resetting Options ${pnl.attr("data-devicetypeid")} - ${devType.id}`);
                    pnl.attr('data-devicetypeid', devType.id);
                    self._createObjectOptions(pnl, devType, binding);
                }
            }
            else {
                pnl.attr('data-devicetypeid', '');
                pnl.empty();
            }
        },
        _createControlOptions: function (pnl, opt, binding) {
            var self = this, o = self.options, el = self.element;
            var fld = null;
            var prop = '';
            
            switch (opt.field.type) {
                case 'hidden':
                    fld = $('<input type="hidden"></input>');
                    if (binding) fld.attr('data-bind', binding + prop);
                    fld.attr('data-datatype', opt.dataType).appendTo(pnl);
                    if (typeof opt.default !== 'undefined') fld.val(opt.default);
                    break;
                case 'pickList':
                    fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).pickList(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                case 'valueSpinner':
                    fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).valueSpinner(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                case 'timeSpinner':
                    fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).timeSpinner(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                case 'inputField':
                    fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).inputField(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                case 'dateField':
                    fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).dateField(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                case 'optionButton':
                    fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).optionButton(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                case 'staticField':
                    fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).staticField(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                case 'checkbox':
                    fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).checkbox(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                case 'actionButton':
                    fld = $('<div></div>').appendTo(pnl);
                    if (binding) fld.attr('data-bind', binding + prop);
                    fld.actionButton(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                case 'toggleButton':
                    fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).toggleButton(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                case 'colorPicker':
                    fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).colorPicker(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                case 'fieldset':
                    fld = $(`<${opt.field.type}></${opt.field.type}>`).appendTo(pnl);
                    if (typeof opt.field.style !== 'undefined') fld.css(opt.field.style);
                    if (typeof opt.binding !== 'undefined') fld.attr('data-bind', opt.binding);
                    if (typeof opt.field.cssClass !== 'undefined') fld.addClass(opt.field.cssClass);
                    if (typeof opt.field.attrs !== 'undefined') {
                        for (var attr in opt.field.attrs) fld.attr(attr.toLowerCase(), opt.field.attrs[attr]);
                    }
                    if (typeof opt.options !== 'undefined') self._createObjectOptions(fld, opt, binding + prop);
                    if (typeof opt.field.legend !== 'undefined') $('<legend></legend>').appendTo(fld).html(opt.field.legend);
                    break;
                case 'panel':
                    fld = $('<div></div>').appendTo(pnl)[`${opt.field.class}`](opt.field);
                    if (typeof opt.field.style !== 'undefined') fld.css(opt.field.style);
                    if (typeof opt.binding !== 'undefined') fld.attr('data-bind', opt.binding);
                    if (typeof opt.field.cssClass !== 'undefined') fld.addClass(opt.field.cssClass);
                    if (typeof opt.field.attrs !== 'undefined') {
                        for (var attr in opt.field.attrs) fld.attr(attr.toLowerCase(), opt.field.attrs[attr]);
                    }
                    break;
                default:
                    fld = $(`<${opt.field.type}></${opt.field.type}>`).appendTo(pnl);
                    if (typeof opt.field.cssClass !== 'undefined') fld.addClass(opt.field.cssClass);
                    if (typeof opt.field.html !== 'undefined') fld.html(opt.field.html);
                    if (typeof opt.field.style !== 'undefined') fld.css(opt.field.style);
                    if (typeof opt.field.binding !== 'undefined') fld.attr('data-bind', opt.field.binding);
                    if (typeof opt.field.attrs !== 'undefined') {
                        for (var attr in opt.field.attrs) fld.attr(attr.toLowerCase(), opt.field.attrs[attr]);
                    }
                    if (typeof opt.options !== 'undefined') self._createObjectOptions(fld, opt, binding + prop);
                    break;
            }
            if (typeof fld !== 'undefined' && typeof opt.field !== 'undefined') {
                if (opt.field.fieldEvents !== 'undefined') {
                    for (var eventName in opt.fieldEvents) {
                        var fevent = opt.fieldEvents[eventName];
                        if (typeof fevent === 'string')
                            fld.on(eventName, new Function('evt', opt.fieldEvents[eventName]));
                        else if (typeof fevent === 'object') {
                            fld.on(eventName, (evt) => { self._callServiceEvent(evt, fevent); });
                        }
                    }

                }
            }
            return fld;
        },
        _callServiceEvent: function(evt, fevent) {
            var self = this, o = self.options, el = self.element;
            var device = dataBinder.fromElement($(evt.currentTarget).parents(`*[data-bindingcontext="device"]:first`));
            var callObj = typeof fevent.callContext !== 'undefined' ? dataBinder.fromElement($(evt.currentTarget).parents(`*[data-bindingcontext="${fevent.callContext}"]`)) : undefined;
            if (typeof fevent.callObj !== 'undefined') callObj = $.extend(true, callObj, fevent.callObj);
            var servicePath = eval(fevent.path);
            switch (fevent.type) {
                case 'putservice':
                    $.putLocalService(servicePath, callObj, fevent.message, function (result, status, xhr) {
                        if (typeof fevent.resultContext !== 'undefined') {
                            var pnl = $(evt.currentTarget).parents(`*[data-bindingcontext="${fevent.resultContext}"]`);
                            dataBinder.bind($(evt.currentTarget).parents(`*[data-bindingcontext="${fevent.resultContext}"]`), result);
                        }
                    });
                    break;
            }
        },
        _createObjectOptions: function (pnl, opts, binding) {
            var self = this, o = self.options, el = self.element;
            var bind = opts.binding || binding;
            for (var i = 0; i < opts.options.length; i++) {
                var opt = opts.options[i];
                self._createControlOptions(pnl, opt, opt.bind);
            }
        },

    });
    $.widget('pic.pnlI2cTriggers', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('i2cdevice-triggers');
        }

    });
    $.widget('pic.pnlI2cFeeds', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('i2cdevice-feeds');
        }
    });
    $.widget('pic.dlgI2cBus', $.pic.modalDialog, {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            o.title = 'Add I2C Bus';
            o.autoOpen = true;
            o.width = '447px';
            o.height = 'auto';
            o.position = { my: "center top", at: "center top", of: window };
            o.buttons = [
                {
                    text: 'Create Bus', icon: '<i class="fas fa-bus-alt"></i>',
                    click: function (evt) {
                        self.addBus();
                    }
                },
                {
                    text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                    click: function () { self.close(); }
                }
            ];
            self._buildControls();
            this._super('_create');
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('dlg-config-i2c');
            el.attr('data-busid', o.id);
            var line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).addClass('script-advanced-instructions').html('Most ECs can have more than one i2c bus.  These are typically identified by a number.  Run i2cdetect -l to see the enabled i2c bus drivers on your system.');
            line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).valueSpinner({ required: true, binding: 'busNumber', labelText: 'Bus #', min: 1, max: 100, labelAttrs: { style: { width: '4rem' } } });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Is Active', binding: 'isActive', value: true });

        },
        addBus: function () {
            var self = this, o = self.options, el = self.element;
            var bus = dataBinder.fromElement(el);
            console.log(bus);
            $.putLocalService('/config/i2c/bus', bus, function (data, status, xhr) {
                console.log(data);
                var evt = $.Event('busadded');
                evt.bus = data;
                el.trigger(evt);
                self.close();
            });

        }
    });
    $.widget('pic.pnlI2cRelay', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-i2cdevice-relay');
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            var line = $('<div></div>').appendTo(el);
            var idType = $('<input type="hidden"></input>').appendTo(line).attr('data-bind', 'options.idType');
            $('<div></div>').appendTo(line).pickList({
                labelText: "Controller",
                binding: 'options.controllerType',
                columns: [{ hidden: true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }, { hidden: false, binding: 'desc', text: 'Controller', style: { whiteSpace: 'nowrap' } }],
                items: o.controllerTypes,
                inputAttrs: { style: { width: '10rem' } }
            }).on('selchanged', function (evt) {
                el.find('div.relay-board').each(function () {
                    this.relayCount(evt.newItem.options.maxRelays);
                    idType.val(evt.newItem.options.idType);
                });
            });
            line = $('<div></div>').appendTo(line);
            $('<hr></hr>').appendTo(line);
            line = $('<div></div>').appendTo(line);
            $('<div></div>').appendTo(el).css({ width: '21rem' }).relayBoard({ binding: 'options.relays' })
                .on('saveRelay', function (evt) {
                })
                .on('clickRelay', function (evt) {
                    console.log(evt);
                    var dev = dataBinder.fromElement(el.parents('div.pnl-i2c-device:first'));
                    $.putLocalService(`/config/i2c/${dev.busNumber}/${dev.address}/deviceCommand/setRelayState`, { id: evt.relay.id, state: !makeBool(evt.relay.state) }, 'Setting Relay State...', function (res, status, xhr) {
                        evt.currentTarget.setRelay(res);
                    });
                });
        }
    });
    
})(jQuery);
