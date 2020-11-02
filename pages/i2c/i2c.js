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
        dataBind: function (data) {
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
                for (var n = 0; n < addrs.length; n++) {
                    addrs[n].addressName = `${addrs[n].address.toString()} - 0x${addrs[n].address.toString(16).padStart(2, '0')}`;
                    console.log(addrs[n]);1
                    this.addRow(addrs[n]);
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
                $('<div></div>').appendTo(pnl).addClass('pnl-i2cdevice-options');
                if (typeof dt !== 'undefined') self.createDeviceOptions(dt);
                self.dataBind(i2cDevice.device);
            });
            var btnPnl = $('<div class="btn-panel"></div>').appendTo(outer);
            $('<div></div>').appendTo(btnPnl).actionButton({ text: 'Save Device', icon: '<i class="fas fa-save"></i>' })
                .on('click', function (evt) { self.saveDevice(); });
            $('<div></div>').appendTo(btnPnl).actionButton({ text: 'Delete Device', icon: '<i class="fas fa-trash"></i>' })
                .on('click', function (evt) { self.deleteDevice(); });

        },
        saveDevice: function () {
            var self = this, o = self.options, el = self.element;
            if (dataBinder.checkRequired(el)) {
                var dev = dataBinder.fromElement(el);
                console.log(dev);
                dev.busId = o.busId;
                dev.busNumber = o.busNumber;
                dev.address = o.address;
                $.putLocalService('/config/i2c/device', dev, 'Saving I2c Device...', function (i2cDev, status, xhr) {
                    console.log(i2cDev);
                    self.dataBind(i2cDev);
                });
            }
        },
        createDeviceOptions: function (dev) {
            var self = this, o = self.options, el = self.element;
            if (el.attr('data-typeid') !== dev.id.toString()) {
                el.attr('data-typeid', dev.id);
                var pnl = el.find('div.pnl-i2cdevice-options:first');
                pnl.empty();


                console.log(dev);
            }
        },

        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            dataBinder.bind(el, data);
        },
    });
    $.widget('pic.dlgI2cBus', $.pic.modalDialog, {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            console.log(`Creating Dialog`);
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
    
})(jQuery);
