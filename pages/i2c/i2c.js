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
            var divList = $('<div></div>').appendTo(el);
            var divDevice = $('<div></div>').appendTo(el);
            $.getLocalService('/config/options/i2c/' + o.busNumber, null, function (i2cBus, status, xhr) {
                el.attr('data-busid', i2cBus.bus.id);
                o.busId = i2cBus.bus.id;
                console.log(i2cBus);
                $('<div></div>').appendTo(divList).selectList({
                    id: 'i2cAddresses',
                    key: 'address',
                    canCreate: true,
                    actions: { canCreate: true },
                    caption: 'Devices', itemName: 'Device',
                    columns: [{
                        binding: 'addressName', text: 'Address', cellStyle: { verticalAlign: 'top' },
                        style: { width: '87px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }
                    },
                    { binding: 'name', text: 'Name', style: { width: '177px' } }]
                }).on('selected', function (evt) {
                    console.log(evt);
                    divDevice.empty();
                    $('<div></div>').appendTo(divDevice).pnlI2cDevice({ busId: o.busId, busNumber: i2cBus.bus.busNumber, address: evt.dataKey });
                }).on('additem', function (evt) {
                    self._openAddAddressDialog(o.busNumber);
                });
                //.css({ fontSize: '8pt' });
                self.dataBind(i2cBus);
            });

        },
        _openAddAddressDialog: function (busId) {
            var self = this, o = self.options, el = self.element;
            var dlg = $.pic.modalDialog.createDialog('dlgI2cAddAddress', {
                width: '377px',
                height: 'auto',
                title: 'Add I2c Address',
                buttons: [{
                    text: 'Add Address', icon: '<i class="fas fa-at"></i>',
                    click: function (evt) {
                        var a = dataBinder.fromElement(dlg);
                        console.log(a);
                        a.busNumber = busId;
                        $.putLocalService('/config/i2c/addAddress', a, 'Adding I2c Bus Addresses...', function (i2cBus, status, xhr) {
                            self.dataBind(i2cBus);
                            $.pic.modalDialog.closeDialog(dlg);
                        });
                        evt.stopPropagation();
                    }
                },
                {
                    text: 'Re-scan', icon: '<i class="fas fa-eye"></i>',
                    click: function (evt) {
                        $.putLocalService('/config/i2c/scanBus', { busNumber: busId }, 'Scanning I2c Bus Addresses...', function (i2cBus, status, xhr) {
                            console.log(i2cBus);
                            self.dataBind(i2cBus);
                            $.pic.modalDialog.closeDialog(dlg);
                        });
                    }
                },
                {
                    text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                    click: function () { $.pic.modalDialog.closeDialog(this); }
                }]
            });
            $('<div></div>').appendTo(dlg).html(`Provide a known address for any device that could not be detected?`)
            $('<hr></hr>').appendTo(dlg);
            $('<div></div>').appendTo(dlg).addClass('script-advanced-instructions').html(`This action will allow you to configure the device without detection.  However, if you do not define the device or activate it, this address will be removed from the i2c list when devices are queried again.<hr style="margin:3px"></hr>If you would like REM to attempt to rescan the bus press the Re-scan button.`);
            var line = $('<div></div>').appendTo(dlg);
            $('<div></div').appendTo(line).valueSpinner({ canEdit: true, fmtMask: '#', dataType: 'int', binding: 'newAddress', min: 3, max: 127, labelText: 'New Address', labelAttrs: { style: { marginRight: '.25rem' } }, inputAttrs: { maxLength: 4 } });
        },
        loadDevices: function (selAddr) {
            var self = this, o = self.options, el = self.element;
            $.getLocalService('/config/options/i2c/' + o.busNumber, null, function (i2cBus, status, xhr) {
                self.dataBind(i2cBus, selAddr);
            });
        },
        dataBind: function (data, selAddr) {
            var self = this, o = self.options, el = self.element;
            var addrs = typeof data.bus.addresses !== 'undefined' ? data.bus.addresses.slice() : [];
            for (var i = 0; i < data.bus.devices.length; i++) {
                var dev = data.bus.devices[i];
                var addr = addrs.find(elem => elem.address === dev.address);
                if (typeof addr === 'undefined') {
                    console.log(`Adding device name ${dev.address} - ${dev.name || 'Unknown'}`);
                    addrs.push({ address: dev.address, id: dev.id, manufacturer: 0, product: 0, name: dev.name || 'Unknown' });
                }
            }
            addrs.sort((a, b) => { return a.address - b.address });
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
            el.addClass('pnl-device-config');
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
            $('<span></span>').appendTo(head).addClass('header-text').html(`I<span style="vertical-align:super;font-size:.7em;display:inline-block;margin-top:-20px;">2</span>C Device Definition for Address <span class="i2cpnl-address">${o.address} - 0x${o.address.toString(16).padStart(2, '0')}</span>`);
            var pnl = $('<div></div>').appendTo(outer);
            $.getLocalService('/config/options/i2c/' + o.busNumber + '/' + o.address, null, function (i2cDevice, status, xhr) {
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
                $('<div></div>').appendTo(tabBar[0].addTab({ id: 'tabTriggers', text: 'Triggers' })).pnlI2cTriggers({ deviceId: i2cDevice.device.id, busNumber: o.busNumber, busId: o.busId, address: o.address })[0].dataBind(i2cDevice.device.triggers);
                $('<div></div>').appendTo(tabBar[0].addTab({ id: 'tabFeeds', text: 'Feeds' })).pnlI2cFeeds({ deviceId: i2cDevice.device.id, busNumber: o.busNumber, busId: o.busId, address: o.address })[0].dataBind(i2cDevice.device.feeds);
                tabBar[0].selectTabById('tabOptions');
                if (typeof dt !== 'undefined') self.createDeviceOptions(dt);
                i2cDevice.device.busNumber = o.busNumber;
                i2cDevice.device.address = o.address;
                i2cDevice.device.busId = o.busId;
                if (dt.hasReset) el.find('div#btnResetDevice').show();
                else el.find('div#btnResetDevice').hide();
                if (dt.hasChangeAddress) el.find('div#btnChangeAddress').show();
                else el.find('div#btnChangeAddress').hide();
                self.dataBind(i2cDevice.device);
            });
            var btnPnl = $('<div class="btn-panel"></div>').appendTo(outer);
            $('<div></div>').appendTo(btnPnl).actionButton({ id: "btnChangeAddress", text: 'Change Address', icon: '<i class="fas fa-at"></i>' })
                .on('click', function (evt) { self.changeDeviceAddress(); }).hide();
            $('<div></div>').appendTo(btnPnl).actionButton({ id: "btnResetDevice", text: 'Reset Device', icon: '<i class="fas fa-toilet"></i>' })
                .on('click', function (evt) { self.resetDevice(); }).hide();
            $('<div></div>').appendTo(btnPnl).actionButton({ text: 'Save Device', icon: '<i class="fas fa-save"></i>' })
                .on('click', function (evt) { self.saveDevice(); });
            $('<div></div>').appendTo(btnPnl).actionButton({ id: "btnDeleteDevice", text: 'Delete Device', icon: '<i class="fas fa-trash"></i>' })
                .on('click', function (evt) { self.deleteDevice(); }).hide();

        },
        resetDevice: function () {
            var self = this, o = self.options, el = self.element;
            var dev = dataBinder.fromElement(el);
            $.pic.modalDialog.createConfirm('dlgConfirmResetDevice', {
                message: `Are you sure you want to reset device on address ${dev.address}?<hr></hr>This action will reset the device to the default or factory settings.`,
                width: '350px',
                height: 'auto',
                title: 'Confirm Reset Device',
                buttons: [{
                    text: 'Yes', icon: '<i class="fas fa-toilet"></i>',
                    click: function (evt) {
                        $.putLocalService('/config/i2c/device/reset', dev, 'Resetting I2c Device...', function (i2cDev, status, xhr) {
                            self.dataBind(i2cDev);
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
        changeDeviceAddress: function () {
            var self = this, o = self.options, el = self.element;
            var dev = dataBinder.fromElement(el);
            var dlg = $.pic.modalDialog.createDialog('dlgConfirmChangeAddress', {
                width: '377px',
                height: 'auto',
                title: 'Confirm Change Device Address',
                buttons: [{
                    text: 'Yes', icon: '<i class="fas fa-at"></i>',
                    click: function (evt) {
                        var a = dataBinder.fromElement(dlg);
                        a.id = dev.id;
                        a.address = dev.address;
                        a.busNumber = dev.busNumber;
                        console.log(a);
                        $.putLocalService('/config/i2c/device/changeAddress', a, 'Changing I2c Device Address...', function (i2cDev, status, xhr) {
                            self.dataBind(i2cDev);
                            el.parents('div.pnl-i2c-bus:first')[0].loadDevices(a.newAddress);
                        });
                        $.pic.modalDialog.closeDialog(this);
                    }
                },
                {
                    text: 'No', icon: '<i class="far fa-window-close"></i>',
                    click: function () { $.pic.modalDialog.closeDialog(this); }
                }]
            });
            $('<div></div>').appendTo(dlg).html(`Are you sure you want to change the device address from ${dev.address} to another address?`)
            $('<hr></hr>').appendTo(dlg);
            $('<div></div>').appendTo(dlg).addClass('script-advanced-instructions').html(`This action will send the proper commands to reset the device address then reload the device.  Enter a new unique address in decimal for the device below.`);
            var line = $('<div></div>').appendTo(dlg);
            $('<div></div').appendTo(line).valueSpinner({ canEdit: true, fmtMask: '#', dataType: 'int', binding: 'newAddress', min: 3, max: 127, labelText: 'New Address', labelAttrs: { style: { marginRight: '.25rem' } }, inputAttrs: { maxLength: 4 } });
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
                        dev.busId = o.busId;
                        dev.busNumber = o.busNumber;
                        dev.address = o.address;
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
            if (typeof dev === 'undefined' || typeof dev.id === 'undefined' || el.attr('data-typeid') !== dev.id.toString()) {
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
                el.find('div.picActionButton#btnResetDevice').hide();
                el.find('div.picPickList[data-bind="typeId"]').each(function () { this.disabled(false); });
            }
            else {
                tabs.show();
                el.find('div.picActionButton#btnDeleteDevice').show();
                el.find('div.picPickList[data-bind="typeId"]').each(function () { this.disabled(true); });
                if (dt.hasReset)
                    el.find('div.picActionButton#btnResetDevice').show();
                else
                    el.find('div.picActionButton#btnResetDevice').hide();
            }
            var pnlOpts = el.find('div.i2cdevice-options');
            pnlOpts[0].setDeviceType(dt, data);
            $('span.i2cpnl-address').each(function () {
                $(this).text(`${data.address} - 0x${data.address.toString(16).padStart(2, '0')}`);
            });
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
                case 'selectList':
                    fld = $('<div></div>').appendTo(pnl).selectList(opt.field);
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
                case 'tabbar':
                case 'tabBar':
                    fld = $('<div></div>').appendTo(pnl).tabBar(opt.field);
                    // Now we need to deal with all of the tabs.
                    if (typeof opt.tabs !== 'undefined') {
                        for (var tabIndex = 0; tabIndex < opt.tabs.length; tabIndex++) {
                            var tab = opt.tabs[tabIndex]
                            var pane = fld[0].addTab(tab.field);
                            if (typeof tab.options !== 'undefined') self._createControlOptions(pane, tab, binding + prop);
                        }
                    }
                    fld[0].selectFirstVisibleTab();
                    break;
                case 'templateRepeater':
                    fld = $(`<div></div>`).appendTo(pnl).templateRepeater(opt.field);
                    break;
                case 'scriptEditor':
                    fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).scriptEditor(opt.field);
                    if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                    break;
                default:
                    fld = $(`<${opt.field.type || 'div'}></${opt.field.type || 'div'}>`).appendTo(pnl);
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
            var elDevice = $(evt.currentTarget).parents(`*[data-bindingcontext="device"]:first`);
            var device = dataBinder.fromElement(elDevice);
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
                            elDevice.find(`*[data-bindingcontext="${fevent.resultContext}"]`).each(function () { dataBinder.bind($(this), result); })
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
            self._buildControls();
            el[0].dataBind = function (feeds) { self.dataBind(feeds); }
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
                                trigger.busId = trig.bus.id;
                                trigger.busNumber = trig.bus.busNumber;
                                trigger.deviceId = trig.device.id;
                                $.putLocalService('/config/i2c/device/trigger', trigger, 'Saving Trigger...', function (t, status, xhr) {
                                    self.dataBind(t);
                                });
                            }
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }
                ]
            });
            $('<div></div>').appendTo(dlg).text('A trigger is used to change a state variable on the device.  You can add multiple triggers to a device state but the last trigger fired wins to set the state.');
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
                bindColumn: 0, displayColumn: 1, labelText: 'Set Value', binding: 'state.name',
                columns: [{ hidden: true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap', width: '77px' } }, { binding: 'name', text: 'State', style: { minWidth: '9rem', whiteSpace: 'nowrap' } }, { binding: 'desc', text: 'Description', style: { minWidth: '227px' } }],
                items: trig.device.deviceType.inputs, inputAttrs: { style: { width: '9rem' } }, labelAttrs: { style: { width: '7rem' } }
            }).on('selchanged', (evt) => {
                var dsp = dlg.find('div.pnl-state-params');
                dsp.empty();
                if (typeof evt.newItem.options !== 'undefined') templateBuilder.createObjectOptions(dsp, evt.newItem);
            });
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).addClass('pnl-state-params');
            $('<div></div>').appendTo(dlg).pnlI2cTriggerParams({});
            if (typeof trig.trigger.id !== 'undefined') {
                var d = dlg.find('div.pnl-state-params');
                if (typeof trig.trigger !== 'undefined' &&
                    typeof trig.trigger.state !== 'undefined' &&
                    typeof trig.device !== 'undefined' &&
                    typeof trig.device.deviceType !== 'undefined' &&
                    typeof trig.device.deviceType.inputs !== 'undefined') {
                    templateBuilder.createObjectOptions(d, trig.device.deviceType.inputs.find(elem => elem.name === trig.trigger.state.name));
                }
                dlg.find('div.pnl-trigger-params').each(function () {
                    var pnl = this;
                    pnl.dataBind(trig.trigger);
                });
                dataBinder.bind(dlg, trig.trigger);
                setTimeout(() => { dataBinder.bind(dlg, trig.trigger); }, 1);
            }
            dlg.css({ overflow: 'visible' });
            return dlg;
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-i2cdevice-triggers');
            $('<div></div>').appendTo(el).addClass('script-advanced-instructions').html('Triggers act upon input from other devices and are used as inputs for this i2c device.');
            $('<div></div>').appendTo(el).crudList({
                id: 'crudTriggers' + o.deviceId, actions: { canCreate: true, canEdit: true, canRemove: true },
                key: 'id',
                caption: 'Device Triggers', itemName: 'Device Triggers',
                columns: [{ binding: 'connection.name', text: 'Connection', style: { width: '157px' } },
                { binding: 'eventName', text: 'Event', style: { width: '127px' } },
                { binding: 'filter', text: 'Filter', style: { width: '247px' }, cellStyle: { fontSize: '8pt', whiteSpace: 'nowrap' } }]
            }).css({ width: '100%' })
                .on('additem', function (evt) {
                    $.getLocalService('/config/options/i2c/' + o.busNumber + '/' + o.address + '/trigger/0', null, function (triggers, status, xhr) {
                        triggers.trigger = { id: -1, isActive: true };
                        self._createTriggerDialog('dlgAddI2cTrigger', 'Add Trigger to I2c Device', triggers);
                    });
                }).on('edititem', function (evt) {
                    $.getLocalService('/config/options/i2c/' + o.busNumber + '/' + o.address + '/trigger/0', null, function (triggers, status, xhr) {
                        triggers.trigger = o.triggers.find(elem => elem.id == evt.dataKey);
                        self._createTriggerDialog('dlgEditI2cTrigger', 'Edit I2C Device Trigger', triggers);
                    });
                }).on('removeitem', function (evt) {
                    var dlg = $.pic.modalDialog.createConfirm('dlgConfirmDeleteI2cTrigger', {
                        message: 'Are you sure you want to delete Trigger?',
                        width: '350px',
                        height: 'auto',
                        title: 'Confirm Delete Device Trigger',
                        buttons: [{
                            text: 'Yes', icon: '<i class="fas fa-trash"></i>',
                            click: function () {
                                var trigger = o.triggers.find(elem => elem.id == evt.dataKey) || {};
                                trigger.busId = o.busId;
                                trigger.busNumber = o.busNumber;
                                trigger.deviceId = o.deviceId;
                                trigger.address = o.address;
                                trigger.id = evt.dataKey;
                                $.deleteLocalService('/config/i2c/device/trigger', trigger, function (triggers, status, xhr) {
                                    $.pic.modalDialog.closeDialog(dlg);
                                    self.dataBind(triggers)
                                });
                                //o.triggers.splice(evt.dataKey - 1, 1);
                                //self.loadTriggers(o.triggers);
                            }
                        },
                        {
                            text: 'No', icon: '<i class="far fa-window-close"></i>',
                            click: function () { $.pic.modalDialog.closeDialog(this); }
                        }]
                    });
                });//.hide();
        },
        reloadTriggers: function () {
            var self = this, o = self.options, el = self.element;
            var p = dataBinder.fromElement(el);
            $.getLocalService('/config/options/device/' + p.bus.busNumber + '/' + p.device.id, null, function (opts, status, xhr) {
                self.loadTriggers(opts.device.triggers);
            });
        },

        dataBind: function (triggers) {
            var self = this, o = self.options, el = self.element;
            el.find('div.crud-list:first').each(function () {
                this.clear();
                if (typeof triggers !== 'undefined') {
                    for (var i = 0; i < triggers.length; i++) {
                        var trigger = triggers[i];
                        this.addRow(trigger);
                        console.log(trigger);
                    }
                }
            });
            o.triggers = triggers;
        }

    });
    $.widget('pic.pnlI2cTriggerParams', {
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
                                required: true, binding: 'eventName', labelText: "Topic", inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
                            });
                        }
                        $('<hr></hr>').appendTo(el);
                        var tabBar = $('<div></div>').appendTo(el).tabBar();
                        {
                            var binding = tabBar[0].addTab({ id: 'tabBinding', text: 'Binding' });
                            var pnl = $('<div></div>').addClass('pnl-trigger-advanced-bindings').appendTo(binding);
                            $('<div></div>').appendTo(pnl).addClass('script-advanced-instructions').html('<div>Enter plain javascript to transform the incoming data into the state representation for the device.</div><div class="pnl-state-instructions"></div>');
                            $('<div></div>').appendTo(pnl).scriptEditor({ binding: 'stateExpression', prefix: '(connection, trigger, device, data) => {', suffix: '}', codeStyle: { maxHeight: '300px', overflow: 'auto' } });
                            var stateItem = pnl.parents('div.ui-dialog-content:first').find('div[data-bind="state.name"]')[0].selectedItem();
                            el.find('div.pnl-state-instructions').html(typeof stateItem === 'object' ? stateItem.instructions || '' : '');
                        }
                        {
                            // Add in the basic filter bindings.
                            var basic = tabBar[0].addTab({ id: 'tabBasic', text: 'Basic Filters' });
                            var pnl = $('<div></div>').addClass('pnl-trigger-basic-bindings').appendTo(basic);
                        }
                        {
                            var advanced = tabBar[0].addTab({ id: 'tabAdvanced', text: 'Filter Expression' });
                            var pnl = $('<div></div>').addClass('pnl-trigger-advanced-bindings').appendTo(advanced);
                            $('<div></div>').appendTo(pnl).addClass('script-advanced-instructions').html('Enter plain javascript for the filter expression below.  If you do not want to filter this trigger, then leave the expression blank.  Each of the parameter inputs (connection, trigger, pin, and data) are available within the filter function.  To view their available properties click on the parameter to see it\'s definition.  Use return <span style=\"font-weight:bold;\">true.</span> from the filter function to apply the trigger state.');
                            $('<div></div>').appendTo(pnl).scriptEditor({ binding: 'expression', prefix: '(connection, trigger, device, data) => {', suffix: '}', codeStyle: { maxHeight: '300px', overflow: 'auto' } });
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
                    id: 'fldEquipmentId', labelText: 'Id', binding: 'equipmentId', dataType: 'int',
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
                    columns: [{ hidden: true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }, { binding: 'op', text: 'Operator', style: { textAlign: 'center', whiteSpace: 'nowrap' } }, { binding: 'desc', text: 'Description', style: {} }],
                    items: [], inputAttrs: { style: { textAlign: 'center', width: '3rem' } }, labelAttrs: { style: { paddingLeft: '.1rem', display: 'none' } }
                }).hide();
                $('<div></div>').appendTo(line).pickList({
                    required: true, id: 'ddValue',
                    bindColumn: 0, displayColumn: 1, labelText: 'Value', binding: '',
                    columns: [{ hidden: true, binding: 'val', text: 'Value', style: { whiteSpace: 'nowrap' } }, { binding: 'name', text: 'Value', style: {} }],
                    items: [], inputAttrs: { style: { width: '3rem' } }, labelAttrs: { style: { paddingLeft: '.1rem', display: 'none' } }
                }).hide();
                $('<div></div>').appendTo(line).inputField({
                    required: true, id: 'fldValue', labelText: 'Id', binding: '',
                    inputAttrs: { style: { width: '4rem' } }, labelAttrs: { style: { paddingLeft: '.1rem', display: 'none' } }
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
                            id: 'ddValue', dataType: bind.type,
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
                    $.getLocalService('/config/options/i2c/' + o.busNumber + '/' + o.address + '/feeds', null, function (feeds, status, xhr) {
                        feeds.feed = o.feeds.find(elem => elem.id == evt.dataKey);
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
            $('<div></div>').appendTo(line).pickList({
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Send Value', binding: 'sendValue',
                columns: [{ binding: 'name', text: 'Name', style: { maxWidth: '197px' } }, { binding: 'desc', text: 'Type', style: { minWidth: '347px' } }],
                items: f.device.deviceType.outputs, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }

            }).on('selchanged', function (evt) {
                var elSamp = dlg.find('div[data-bind="sampling"]').each(function () {
                    if (evt.newItem.maxSamples <= 1 || typeof evt.newItem.maxSamples === 'undefined') this.val(1);
                    this.options({ max: evt.newItem.maxSamples || 1 });
                });
                if (evt.newItem.maxSamples <= 1 || typeof evt.newItem.maxSamples === 'undefined') elSamp.hide();
                else elSamp.show();
            });
            $('<div></div>').appendTo(line).checkbox({ binding: 'changesOnly', labelText: 'Only When Changed' });
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).valueSpinner({
                required: true, canEdit: true, binding: 'sampling', labelText: 'Sampling', fmtMask: '#,##0', dataType: 'number', step: 1,
                min: 1, max: 20, units: `smooth reading using median samples`, inputAttrs: { style: { width: '4rem' } }, labelAttrs: { style: { width: '7rem' } }
            }).hide();

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
                        o.bindings = bindings;
                        console.log(bindings);
                        $('<hr></hr>').appendTo(el);
                        var line = $('<div></div>').appendTo(el);
                        var lbl = type === 'njspc' || type === 'webSocket' ? 'Socket Event' : 'Topic';
                        if (typeof o.bindings.devices !== 'undefined' && type === 'internal') {
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
                $('<div></div>').addClass('pnl-feed-params').appendTo(line);
            }
            else {
                pnl.find('div.picPickList:first').each(function () {
                    this.items(typeof feed !== 'undefined' ? feed.bindings : []);
                });
                let pnlParams = pnl.find('div.pnl-feed-params');
                if (typeof feed === 'undefined' || typeof feed.options === 'undefined' || pnlParams.attr('data-feedname') !== feed.name) pnlParams.empty();
                if (typeof feed !== 'undefined' && typeof feed.options !== 'undefined' && pnlParams.attr('data-feedname') !== feed.name) {
                    // Bind up these params.
                    templateBuilder.createObjectOptions(pnlParams, feed);
                }
                if (typeof feed !== 'undefined') dataBinder.bind(pnlParams, feed);
                pnlParams.attr('data-feedname', typeof feed !== 'undefined' ? feed.pnlParams || '' : '');
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
                    items: typeof feed !== 'undefined' ? feed.bindings : [], inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
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
            if (o.controllerTypes.length === 1) {
                line.css({ display: 'none' });
            }
            else {
                line = $('<div></div>').appendTo(line);
                $('<hr></hr>').appendTo(line);
            }
            line = $('<div></div>').appendTo(line);
            $('<div></div>').appendTo(el).css({ width: '21rem' }).relayBoard({ binding: 'values.relays' })
                .on('saveRelay', function (evt) {
                    var dev = dataBinder.fromElement(el.parents('div.pnl-i2c-device:first'));
                    $.putLocalService(`/config/i2c/${dev.busNumber}/${dev.address}/deviceCommand/setRelayOptions`, [evt.relay], 'Saving Relay...', function (res, status, xhr) {
                    });
                })
                .on('clickRelay', function (evt) {
                    console.log(evt);
                    var dev = dataBinder.fromElement(el.parents('div.pnl-i2c-device:first'));
                    $.putLocalService(`/config/i2c/${dev.busNumber}/${dev.address}/deviceCommand/setRelayState`, { id: evt.relay.id, state: !makeBool(evt.relay.state) }, 'Setting Relay State...', function (res, status, xhr) {
                        evt.currentTarget.setRelay(res);
                    });
                });
            if (o.controllerTypes.length === 1) {
                el.find('div.relay-board').each(function () {
                    this.relayCount(o.controllerTypes[0].options.maxRelays);
                    idType.val(o.controllerTypes[0].options.idType);
                });
            }
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined')
                el.find('div.relay-board').each(function () {
                    for (var i = 0; i < val.length; i++)  this.setRelay(val[i]);
                });
        }
    });
    $.widget('pic.pnlI2cADC', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-i2cdevice-adc');
            el.attr('data-bind', 'options.channelStates');
            el[0].val = function (val) { return self.val(val); }
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            var line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).pickList({
                labelText: "Converter",
                value: o.adcType,
                binding: 'options.adcType',
                required: true,
                columns: [{ hidden: true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }, { hidden: false, binding: 'desc', text: 'Converter', style: { whiteSpace: 'nowrap' } }],
                items: o.adcTypes,
                inputAttrs: { style: { width: '10rem' } }
            }).on('selchanged', function (evt) {
                el.find('div.adc-board').each(function () { this.channelCount(evt.newItem.options.maxChannels); });
            });
            var type = o.adcTypes.find(elem => elem.name === o.adcType);
            console.log(type);
            line = $('<div></div>').appendTo(line);
            $('<hr></hr>').appendTo(line).css({ margin: '3px' });
            line = $('<div></div>').appendTo(line);
            $('<div></div>').appendTo(el).css({ width: '21rem' }).adcBoard({
                binding: 'options.channels',
                total: (typeof type !== 'undefined' && typeof type.options !== 'undefined') ? type.options.maxChannels || 0 : 0
            })
                .on('saveChannel', function (evt) {
                    console.log(evt);
                });
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined')
                el.find('div.adc-board').each(function () {
                    for (var i = 0; i < val.length; i++)  this.setChannel(val[i]);
                });
        }
    });


})(jQuery);
