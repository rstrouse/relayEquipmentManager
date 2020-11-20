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
            el[0].setChildren = function (selector, data) { return self.setChildren(selector, data); };
            el[0].setConnected = function (val) { return self.setConnected(val); }
            el[0].setStatus = function (data) { return self.setStatus(data); };
        },
        setConnected: function (val) {
            var self = this, o = self.options, el = self.element;
            if (val) el.find('div.i2c-status-overlay').remove();
            else {
                var overlay = el.find('div.i2c-status-overlay');
                if (overlay.length === 0) {
                    $('<div></div>').addClass('i2c-status-overlay').appendTo(el);
                }
            }
        },
        setStatus: function (val) {
            var self = this, o = self.options, el = self.element;
        },
        setChildren: function (selector, data) {
            var self = this, o = self.options, el = self.element;
            console.log({ name: 'Set Children', selector: selector, data: data });
            el.find(selector).each(function () {
                $this = $(this);
                if (typeof data.show !== 'undefined') {
                    data.show ? $this.show() : $this.hide();
                }
                if (typeof data.hide !== 'undefined') {
                    data.hide ? $this.hide() : $this.show();
                }
                if (typeof data.val !== 'undefined') {
                    this.val(data.val);
                }
            });
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-i2c-device');
            el.attr('data-busnumber', o.busNumber);
            el.attr('data-address', o.address);
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
                o.deviceId = i2cDevice.id;
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
                var samp = $('<div></div>').appendTo(line).valueSpinner({ required: true, binding: binding + 'sampling', labelText: 'Sampling', min: 1, max: 100, labelAttrs: { style: { width: '5rem' } } }).hide();
                var dt = o.deviceTypes.find(elem => elem.id === i2cDevice.device.typeId) || { id: i2cDevice.device.typeId, takeSamples: false };
                if (dt.takeSamples) samp.show();
                var tabBar = $('<div></div>').appendTo(pnl).tabBar().on('tabchange', function (evt) {
                    evt.stopPropagation();
                }).hide();
                $('<div></div>').appendTo(tabBar[0].addTab({ id: 'tabOptions', text: 'Device Options' })).pnlI2cOptions();
                $('<div></div>').appendTo(tabBar[0].addTab({ id: 'tabTriggers', text: 'Triggers' })).pnlI2cTriggers();
                $('<div></div>').appendTo(tabBar[0].addTab({ id: 'tabFeeds', text: 'Feeds' })).pnlI2cFeeds({deviceId: i2cDevice.device.id, busNumber: o.busNumber, busId: o.busId, address: o.address })[0].dataBind(i2cDevice.device.feeds);
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
            $('<div></div>').appendTo(btnPnl).actionButton({ id: "btnDeleteDevice", text: 'Delete Device', icon: '<i class="fas fa-trash"></i>' })
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
            {
                var pnl = $(evt.currentTarget).parents('.pnl-alarm:first'); if(evt.newVal) { pnl.find('div[data-bind=\"options.alarm.enableHumidity\"]').each(function() { this.val(false); }); pnl.find('*[data-bind=\"options.alarm.humidity\"]').hide(); pnl.find('*[data-bind=\"options.alarm.dewpoint\"]').show(); pnl.find('*[data-bind=\"options.alarm.tolerance\"]').show(); } else { pnl.find('*[data-bind=\"options.alarm.dewpoint\"]').hide(); pnl.find('*[data-bind=\"options.alarm.tolerance\"]').hide(); }

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
                        $.deleteLocalService('/config/i2c/device', dev, 'Deleting I2c Device...', function (i2cDev, status, xhr) {
                            self.dataBind({ id: '', busId: dev.busId, busNumber: dev.busNumber, address: dev.address, isActive: false, typeId: 0 });
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
            el.attr('data-address', o.address);
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
                case 'chemTank':
                    fld = $('<div></div>').appendTo(pnl).chemTank(opt.field);
                    if (binding) fld.attr('data-bind', binding + prop);
                    break;
                case 'fieldset':
                    fld = $(`<${opt.field.type}></${opt.field.type}>`).appendTo(pnl);
                    if (typeof opt.field.legend !== 'undefined') $('<legend></legend>').appendTo(fld).html(opt.field.legend);
                    if (typeof opt.field.style !== 'undefined') fld.css(opt.field.style);
                    if (typeof opt.binding !== 'undefined') fld.attr('data-bind', opt.binding);
                    if (typeof opt.field.cssClass !== 'undefined') fld.addClass(opt.field.cssClass);
                    if (typeof opt.field.attrs !== 'undefined') {
                        for (var attr in opt.field.attrs) fld.attr(attr.toLowerCase(), opt.field.attrs[attr]);
                    }
                    if (typeof opt.options !== 'undefined') self._createObjectOptions(fld, opt, binding + prop);
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
                        if (typeof fevent === 'string') {
                            console.log('Adding field event:' + fevent);
                            fld.on(eventName, new Function('evt', fevent));
                        }
                        else if (typeof fevent === 'object') {
                            fld.on(eventName, (evt) => {
                                if (typeof fevent.confirm === 'object') {
                                    var confirm = $.pic.modalDialog.createConfirm("dlgConfirmEvent", $.extend(true, {}, {
                                        title: 'Confirm Action',
                                        message: 'Are you sure you want to do this?'
                                    }, fevent.confirm)).on('confirmed', function (e) { self._callServiceEvent(evt, fevent); });
                                }
                                else
                                    self._callServiceEvent(evt, fevent);
                            });
                        }
                    }

                }
            }
            return fld;
        },
        _callServiceEvent: function (evt, fevent) {
            var self = this, o = self.options, el = self.element;
            var device = dataBinder.fromElement($(evt.currentTarget).parents(`*[data-bindingcontext="device"]:first`));
            var callObj;
            if (typeof fevent.callContext !== 'undefined') callObj = dataBinder.fromElement($(evt.currentTarget).parents(`*[data-bindingcontext="${fevent.callContext}"]`));
            if (typeof fevent.eventObject === 'string') callObj = $.extend(true, {}, callObj, evt[fevent.eventObject]);
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
            self._buildControls();
            el[0].dataBind = function (feeds) { self.dataBind(feeds); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-i2cdevice-feeds');
            $('<div></div>').appendTo(el).addClass('script-advanced-instructions').html('Feeds send values from the device via a connection to other software.  The defined connection determines the format, protocol, and potential data that is sent.');
            $('<div></div>').appendTo(el).crudList({
                id: 'crudFeeds' + o.deviceId, actions: { canCreate: true, canEdit: true, canRemove: true },
                key: 'id',
                caption: 'Device Value Feeds', itemName: 'Value Feeds',
                columns: [{ binding: 'connection.name', text: 'Connection', style: { width: '157px' } }, { binding: 'sendValue', text: 'Value', style: { width: '127px' } }, { binding: 'propertyDesc', text: 'Property', style: { width: '247px' }, cellStyle: {} }]
            }).css({ width: '100%' })
                .on('additem', function (evt) {
                    $.getLocalService('/config/options/i2c/' + o.busNumber + '/' + o.address + '/feeds', null, function (feeds, status, xhr) {
                        feeds.feed = { isActive: true };
                        self._createFeedDialog('dlgAddI2cFeed', 'Add Feed to I2c Device', feeds);
                    });
                }).on('edititem', function (evt) {
                    $.getLocalService('/config/options/i2c/' + o.busId + '/' + o.address + '/feeds', null, function (feeds, status, xhr) {
                        feeds.feed = o.feeds.find(elem => elem.id ==  evt.dataKey);
                        self._createFeedDialog('dlgEditI2cFeed', 'Edit I2C Device Feed', feeds);
                    });
                }).on('removeitem', function (evt) {
                    var dlg = $.pic.modalDialog.createConfirm('dlgConfirmDeleteI2cFeed', {
                        message: 'Are you sure you want to delete Feed?',
                        width: '350px',
                        height: 'auto',
                        title: 'Confirm Delete Device Feed',
                        buttons: [{
                            text: 'Yes', icon: '<i class="fas fa-trash"></i>',
                            click: function () {
                                var feed = o.feeds.find(elem => elem.id == evt.dataKey) || {};
                                feed.busId = o.busId;
                                feed.busNumber = o.busNumber;
                                feed.deviceId = o.deviceId;
                                feed.address = o.address;
                                feed.id = evt.dataKey;
                                $.deleteLocalService('/config/i2c/device/feed', feed, function (feeds, status, xhr) {
                                    $.pic.modalDialog.closeDialog(dlg);
                                    self.dataBind(feeds)
                                });
                                //o.feeds.splice(evt.dataKey - 1, 1);
                                //self.loadFeeds(o.feeds);
                            }
                        },
                        {
                            text: 'No', icon: '<i class="far fa-window-close"></i>',
                            click: function () { $.pic.modalDialog.closeDialog(this); }
                        }]
                    });
                });

        },
        _createFeedDialog: function (id, title, f) {
            var self = this, o = self.options, el = self.element;
            if ($(`div#${id}`).length > 0) return;

            var dlg = $.pic.modalDialog.createDialog(id, {
                width: '547px',
                height: 'auto',
                title: title,
                position: { my: "center top", at: "center top", of: window },
                buttons: [
                    {
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: function (evt) {
                            var feed = dataBinder.fromElement(dlg);
                            if (dataBinder.checkRequired(dlg, true)) {
                                feed.connection = dlg.find('div[data-bind="connectionId"]')[0].selectedItem();
                                feed.busId = o.busId;
                                feed.busNumber = o.busNumber;
                                feed.deviceId = o.deviceId;
                                feed.address = o.address;
                                ///feed.device = dlg.find('div[data-bind="deviceBinding"]')[0].selectedItem();
                                self.saveFeed(feed);
                                $.pic.modalDialog.closeDialog(this);
                            }
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }
                ]
            });
            $('<div></div>').appendTo(dlg).text('A Data Feed is used to transport data to the specified data source.  You can add multiple data feeds for the device.');
            $('<hr></hr>').appendTo(dlg);
            var line = $('<div></div>').appendTo(dlg);
            $('<input type="hidden"></input>').appendTo(dlg).attr('data-bind', 'id').attr('data-datatype', 'int').val(-1);
            var conn = $('<div></div>').appendTo(line).pickList({
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Connection', binding: 'connectionId',
                columns: [{ hidden: true, binding: 'id', text: 'Id', style: { whiteSpace: 'nowrap' } }, { binding: 'name', text: 'Name', style: { minWidth: '197px' } }, { binding: 'type.desc', text: 'Type', style: { minWidth: '147px' } }],
                items: f.connections, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
            })
                .on('selchanged', function (evt) {
                    dlg.find('div.pnl-i2c-feed-params').each(function () { this.setConnection(evt.newItem); });
                });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Is Active', binding: 'isActive', value: true });
            line = $('<div></div>').appendTo(dlg);
            //$('<div></div>').appendTo(line).valueSpinner({
            //    required: true, canEdit: true, binding: 'frequency', labelText: 'Send Every', fmtMask: '#,###.##', dataType: 'number', step: .1,
            //    min: .1, max: 1000, units: 'seconds', inputAttrs: { style: { width: '4rem' } }, labelAttrs: { style: { width: '7rem' } }
            //});
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).pickList({
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Send Value', binding: 'sendValue',
                columns: [{ binding: 'name', text: 'Name', style: { maxWidth: '197px' } }, { binding: 'desc', text: 'Type', style: { minWidth: '347px' } }],
                items: f.device.deviceType.outputs, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
                
            });
            $('<div></div>').appendTo(line).checkbox({ binding: 'changesOnly', labelText: 'Only When Changed' });
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(dlg).pnlI2cFeedParams({ device: f.device });
            if (typeof f.feed.id !== 'undefined') {
                conn[0].disabled(true);
                dlg.find('div.pnl-i2c-feed-params').each(function () {
                    var pnl = this;
                    this.dataBind(f.feed);
                });
                dataBinder.bind(dlg, f.feed);
            }
            dlg.css({ overflow: 'visible' });
            return dlg;
        },
        saveFeed: function (feed) {
            var self = this, o = self.options, el = self.element;
            $.putLocalService('/config/i2c/device/feed', feed, 'Saving Device Feed...', function (f, result, xhr) {
                self.dataBind(f);
            });
        },
        dataBind: function (feeds) {
            var self = this, o = self.options, el = self.element;
            var felem = el.find('div.crud-list:first').each(function () {
                this.clear();
                for (var i = 0; i < feeds.length; i++) {
                    var feed = feeds[i];
                    this.addRow(feed);
                }
            });
            o.feeds = feeds;
        }
    });
    $.widget('pic.pnlI2cFeedParams', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].setConnection = function (conn) { self.setConnection(conn); };
            el[0].dataBind = function (data) { self.dataBind(data); };
            el[0].setTopic = function (data) { self.setTopic(data); };
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-i2c-feed-params');
        },
        setTopic: function () {
            var self = this, o = self.options, el = self.element;

        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            self.setConnection(data.connection, function () {
                var fldEventName = el.find('div[data-bind="eventName"]');
                if (typeof data.eventName !== 'undefined' && fldEventName.length > 0) {
                    if (fldEventName[0].val() !== data.eventName) {
                        fldEventName[0].val(data.eventName);
                        dataBinder.bind(el, data);
                    }
                }
                else {
                    console.log(data);
                    dataBinder.bind(el, data);
                }
            });
        },

        setConnection: function (conn, callback) {
            var self = this, o = self.options, el = self.element;
            let type = typeof conn !== 'undefined' && typeof conn.type !== 'undefined' && conn.id !== 0 ? conn.type.name : '';
            if (el.attr('data-conntype') !== type || type === '') {
                el.attr('data-conntype', type);
                el.empty();
                o.bindings = undefined;
                if (type !== '') {
                    $.searchLocalService('/config/connection/bindings', { name: type }, 'Getting Connection Bindings...', function (bindings, status, xhr) {
                        console.log(bindings);
                        o.bindings = bindings;
                        $('<hr></hr>').appendTo(el);
                        var line = $('<div></div>').appendTo(el);
                        var lbl = type === 'njspc' || type === 'webSocket' ? 'Socket Event' : 'Topic';
                        if (typeof o.bindings.devices !== 'undefined' && o.bindings.devices.length > 0) {
                            $('<div></div>').appendTo(line).pickList({
                                required: true,
                                bindColumn: 0, displayColumn: 2, labelText: 'to Device', binding: 'deviceBinding',
                                columns: [{ hidden: true, binding: 'uid', text: 'uid' }, { binding: 'type', text: 'Type' }, { binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }],
                                items: bindings.devices, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
                            })
                                .on('selchanged', function (evt) {
                                    var itm = o.bindings.devices.find(elem => elem.uid === evt.newItem.uid);
                                    self._build_deviceBindings(itm);
                                });
                            self._build_deviceBindings();
                        }
                        else if (typeof o.bindings.feeds !== 'undefined' && o.bindings.feeds.length >= 1) {
                            $('<div></div>').appendTo(line).pickList({
                                required: true,
                                bindColumn: 0, displayColumn: 0, labelText: lbl, binding: 'eventName',
                                columns: [{ binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }],
                                items: bindings.feeds, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
                            })
                                .on('selchanged', function (evt) {
                                    var itm = o.bindings.feeds.find(elem => elem.name === evt.newItem.name);
                                    self._build_bindings(itm);
                                });
                            self._build_bindings();
                        }
                        else {
                            $('<div></div>').appendTo(line).inputField({
                                required: true, binding: 'eventName', labelText: "Topic", inputAttrs: { style: { width: '17rem' } }, labelAttrs: { style: { width: '7rem' } }
                            });
                            line = $('<div></div>').appendTo(el);
                            $('<div></div>').appendTo(line).addClass('script-advanced-instructions').html('Enter plain javascript for the generated payload.  Return a string, number, or object from the function.');

                            line = $('<div></div>').appendTo(el);
                            $('<div></div>').appendTo(line).scriptEditor({ binding: 'payloadExpression', prefix: '(feed, value): any => {', suffix: '}', codeStyle: { maxHeight: '300px', overflow: 'auto' } });
                        }
                        if (typeof callback === 'function') { callback(); }
                    });
                }
                else if (typeof callback === 'function') { callback(); }
            }
            //else if (typeof callback === 'function') { console.log('callback2 called'); callback(); }
        },
        _build_bindings: function (feed) {
            var self = this, o = self.options, el = self.element;
            let pnl = el.find('div.pnl-device-bindings');
            if (pnl.length === 0) {
                var line = $('<div></div>').addClass('pnl-device-bindings').appendTo(el);
                $('<div></div>').appendTo(line).pickList({
                    canEdit: true,
                    binding: 'property', labelText: 'Property',
                    bindColumn: 0, displayColumn: 0,
                    columns: [{ binding: 'binding', text: 'Variable', style: { whiteSpace: 'nowrap' } }],
                    items: typeof feed !== 'undefined' ? feed.bindings : [], inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
                });
            }
            else {
                pnl.find('div.picPickList:first').each(function () {
                    this.items(typeof feed !== 'undefined' ? feed.bindings : []);
                });
            }
        },
        _build_deviceBindings: function (feed) {
            var self = this, o = self.options, el = self.element;
            let pnl = el.find('div.pnl-device-bindings');
            if (pnl.length === 0) {
                var line = $('<div></div>').addClass('pnl-device-bindings').appendTo(el);
                $('<div></div>').appendTo(line).pickList({
                    canEdit: true,
                    binding: 'property', labelText: 'Input',
                    bindColumn: 0, displayColumn: 0,
                    columns: [{ binding: 'name', text: 'Input', style: { whiteSpace: 'nowrap' } }, { binding: 'desc', text: 'Description', style: { whiteSpace: 'nowrap' } }],
                    items: typeof feed !== 'undefined' ? feed.bindings: [], inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
                });
            }
            else {
                pnl.find('div.picPickList:first').each(function () {
                    this.items(typeof feed !== 'undefined' ? feed.bindings : []);
                });
            }
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
            el.attr('data-bind', 'relayStates');
            el[0].val = function (val) { return self.val(val); }

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
            $('<div></div>').appendTo(el).css({ width: '21rem' }).relayBoard({ binding: 'values.relays' })
                .on('saveRelay', function (evt) {
                })
                .on('clickRelay', function (evt) {
                    console.log(evt);
                    var dev = dataBinder.fromElement(el.parents('div.pnl-i2c-device:first'));
                    $.putLocalService(`/config/i2c/${dev.busNumber}/${dev.address}/deviceCommand/setRelayState`, { id: evt.relay.id, state: !makeBool(evt.relay.state) }, 'Setting Relay State...', function (res, status, xhr) {
                        evt.currentTarget.setRelay(res);
                    });
                });
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined')
                el.find('div.relay-board').each(function () {
                    for (var i = 0; i < val.length; i++)  this.setRelay(val[i]);
                });
        }
    });

})(jQuery);
