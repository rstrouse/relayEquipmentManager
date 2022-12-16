(function ($) {
    $.widget('pic.pnlCfgGenericDevices', {
        options: { cfg: {} },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            // var tabs = $('<div class="picTabPanel"></div>').appendTo(el);
            el.addClass('pnl-generic-devices');
            $.getLocalService('/config/options/genericDevices', null, function (data, status, xhr) {
                //var outer = $('<div></div>').appendTo(el).addClass('control-panel');
                //var head = $('<div></div>').appendTo(outer).addClass('pnl-settings-header').addClass('control-panel-title');
                //$('<span></span>').appendTo(head).addClass('header-text').text('Manage Generic Devices');
                //$('<br></br>').appendTo(outer);
                var devices = $('<div></div>').appendTo(el).pnlDevices().css({ display: 'inline-block', marginRight: '.5rem' });

                // o.deviceTypes = data.deviceTypes;
                devices[0].dataBind(data.genericDevices.devices);
            });
        }
    });

    $.widget('pic.pnlDevices', {
        options: { cfg: {} },
        // The devices need to be things like
        // 1. Pressure Guages
        // 2. Slack
        // 3. 10k Temp Sensors
        // 4. NTC Thermistors
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (genDev) { self.dataBind(genDev); }
            el[0].reloadGenericDevices = function () { self._reloadGenericDevices(); }
            el[0].selectDeviceById = function (id) { self._selectDeviceById(id); }
            el[0].saveDevice = function (device) { self._saveDevice(device); }
        },
        _reloadGenericDevices() {
            var self = this, o = self.options, el = self.element;
            $.getLocalService('/config/options/genericDevices', null, function (genDev, status, xhr) {
                //console.log(genDev);
                self.dataBind(genDev.genericDevices.devices);
            });
        },
        _selectDeviceById: function (deviceId) {
            var self = this, o = self.options, el = self.element;
            el.find('div.slist-list:first')[0].selectByKey(deviceId);
        },
        _saveDevice: function (device) {
            var self = this, o = self.options, el = self.element;
            var list = el.find('div.slist-list:first')[0];
            if (typeof device !== 'undefined') {
                list.saveRow(device);
                //list.selectByKey(device.id);
            }
        },
        _createDeviceDialog: function (id, title, deviceTypes) {
            console.log(deviceTypes)
            var self = this, o = self.options, el = self.element;
            var dlg = $.pic.modalDialog.createDialog(id, {
                width: '570px',
                height: 'auto',
                title: title,
                buttons: [
                    {
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: function () {
                            var device = dataBinder.fromElement(dlg);
                            device.options = { name: device.name };
                            if (dataBinder.checkRequired(dlg, true)) {
                                $.putLocalService('/config/genericDevices/device', device, 'Saving Generic Device...', function (genDev, status, xhr) {
                                    // $.pic.modalDialog.closeDialog(self);
                                    $.pic.modalDialog.closeDialog($.find('div#create-generic-device'));
                                    //self._reloadGenericDevices();
                                    self._saveDevice(genDev);
                                    setTimeout(() => { self._selectDeviceById(genDev.id) }, 1);
                                });
                            }
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }]
            });
            $('<input type="hidden"></input>').appendTo(dlg).attr('data-bind', "id").attr('data-datatype', 'int');
            $('<div></div>').appendTo(dlg)
                .text('Generic devices can accept feeds from other devices or triggers, take action, and emit results on a feed.');
            $('<hr></hr>').appendTo(dlg);
            var line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).pickList({
                id: 'create-generic-device',
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Device', binding: 'typeId',
                columns: [{ hidden: false, binding: 'id', text: 'id', style: { whiteSpace: 'nowrap' } }, { binding: 'name', text: 'Name', style: { minWidth: '157px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, { binding: 'category', text: 'Category', style: { minWidth: '327px' } }],
                items: deviceTypes, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '5.5rem' } }
            }).on('selchanged', function (e) {
                var c = dataBinder.fromElement(dlg);
                for (var prop in e.newItem) {
                    c[prop] = e.newItem[prop];
                }
                // rsg - need to normalize arrays/objects
                if (!Array.isArray(c.options)) c.options = [c.options];
                // c.device = e.newItem;

                // need to close panel in addition to disable
                //dlg.find('div.picPickList[data-bind="typeId"]')[0].disabled(true);
                //dlg.find('div.picPickList[data-bind="typeId"]')[0].blur();
                //dlg.find('div.pnl-generic-device-details').each(function () { this.dataBind({deviceType: c}); });
            });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Is Active', binding: 'isActive' });
            line = $('<div></div>').appendTo(dlg);
            $('<input type="hidden"></input>').appendTo(line).attr('data-bind', 'id').attr('data-datatype', 'int');
            $('<div></div>').appendTo(line).inputField({ labelText: 'Name', binding: 'name', inputAttrs: { maxlength: 24 }, labelAttrs: { style: { width: '5.5rem' } } });
            //$('<div></div>').appendTo(dlg).pnlDeviceDetails({ deviceType: {options: {}} })
            dlg.css({ overflow: 'visible' });
            return dlg;
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-generic-devices-crud').addClass('list-outer');
            el.attr('data-bind', o.binding)
            $('<div></div>').appendTo(el).selectList({
                id: 'genericDeviceList',
                key: 'id',
                canCreate: true,
                actions: { canCreate: true },
                caption: 'Devices', itemName: 'GenericDevice',
                columns: [{ binding: 'options.name', text: 'Name', style: { width: '177px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                { binding: 'deviceType.name', text: 'Type', style: { width: '197px' } }]
            }).on('selected', function (evt) {
                $.getLocalService('/config/options/genericDevices', null, function (data, status, xhr) {
                    let device = data.genericDevices.devices.find(el => el.id === evt.dataKey);
                    $('#pnl-edit-generic-device').remove();
                    if (typeof device !== 'undefined')  $('<div></div>').appendTo('.pnl-generic-devices').pnlDeviceTab(device);
                });
            }).on('additem', function (evt) {
                $.getLocalService('/config/options/genericDevices', null, function (data, status, xhr) {
                    $('#pnl-edit-generic-device').remove();
                    var dlg = self._createDeviceDialog('dlgAddGenericDevice', 'Add a new Generic Device', data.deviceTypes);
                    dataBinder.bind(dlg, { isActive: true });
                });
            });
            /*
            $('<div></div>').appendTo(el).crudList({
                key: 'id', actions: { canCreate: true, canEdit: true, canRemove: true },
                caption: 'Devices', itemName: 'GenericDevice',
                columns: [{ binding: 'options.name', text: 'Name', style: { width: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                { binding: 'deviceType.category', text: 'Type', style: { width: '177px' } }]
            }).on('additem', function (evt) {
                $.getLocalService('/config/options/genericDevices', null, function (data, status, xhr) {
                    $('#pnl-edit-generic-device').remove();
                    var dlg = self._createDeviceDialog('dlgAddGenericDevice', 'Add a new Generic Device', data.deviceTypes);
                    dataBinder.bind(dlg, { isActive: true });
                });
            }).on('edititem', function (evt) {
                $.getLocalService('/config/options/genericDevices', null, function (data, status, xhr) {
                    let device = data.genericDevices.devices.find(el => el.id === evt.dataKey);
                    // var dlg = self._editDeviceDialog('dlgEditGenericDevice', 'Edit a Generic Device', device);
                    // divDevice.empty();
                    // $('<div></div>').appendTo(divDevice).self._editDeviceDialog('dlgEditGenericDevice', 'Edit a Generic Device', device);
                    // dataBinder.bind(dlg, device);

                    // dataBinder.bind(dlg, device);  // Bind it twice to make sure we have all the data.
                    $('#pnl-edit-generic-device').remove();
                    $('<div></div>').appendTo('.pnl-generic-devices').pnlDeviceTab(device);
                });
            }).on('removeitem', function (evt) {
                var device = dataBinder.fromElement(el);
                $('#pnl-edit-generic-device').remove();
                $.pic.modalDialog.createConfirm('dlgConfirmConnection', {
                    message: '<div>Are you sure you want to delete generic device <b>' + device.options.name + '</b>?</div><hr></hr><div><span style="color:red;font-weight:bold;">WARNING:</span> If you delete this device it will remove all <span style="font-weight:bold;">triggers and feeds</span> associated with this device.</div>',
                    width: '377px',
                    height: 'auto',
                    title: 'Confirm Delete Connection',
                    buttons: [{
                        text: 'Yes', icon: '<i class="fas fa-trash"></i>',
                        click: function () {
                            $.pic.modalDialog.closeDialog(this);
                            $.deleteLocalService('/config/genericDevices/device', { id: evt.dataKey }, 'Deleting Connection...', function (c, status, xhr) {
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
            */
        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            var list = el.find('div.slist-list:first')[0];
            list.clear();
            for (var i = 0; i < data.length; i++) {
                //console.log(data[i]);
                list.addRow(data[i]);
            }
        }
    });



    $.widget('pic.pnlDeviceTab', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el[0].dataBind = function (dev) { self.dataBind(dev); }
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            $('.pnl-generic-device-tabs').empty();
            el.addClass('pnl-generic-device-tabs');
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            $('<input type="hidden"></input>').appendTo(el).attr('data-bind', "typeId").attr('data-datatype', 'int')
            $('<input type="hidden"></input>').appendTo(el).attr('data-bind', "id").attr('data-datatype', 'int');
            el.attr('data-typeId', o.typeId);
            el.attr('data-id', o.id);
            var outer = $('<div></div>').appendTo(el).addClass('control-panel');
            var head = $('<div></div>').appendTo(outer).addClass('pnl-settings-header').addClass('control-panel-title').text('Edit a generic device');
            $('<span></span>').appendTo(head).addClass('header-text');
            var pnl = $('<div></div>').appendTo(outer);
            var tabBar = $('<div></div>').appendTo(pnl).tabBar().on('tabchange', function (evt) {
                evt.stopPropagation();
            });
            o.deviceId = o.id;
            $('<div></div>').appendTo(tabBar[0].addTab({ id: 'tabOptions', text: 'Device Options' })).pnlDeviceDetails(o)
            $('<div></div>').appendTo(tabBar[0].addTab({ id: 'tabTriggers', text: 'Triggers' })).pnlDeviceTriggers(o)[0].dataBind(o.triggers);
            $('<div></div>').appendTo(tabBar[0].addTab({ id: 'tabFeeds', text: 'Feeds' })).pnlDeviceFeeds(o)[0].dataBind(o.feeds);
            tabBar[0].selectTabById('tabOptions');
            el.attr('id', 'pnl-edit-generic-device');
            el.addClass('pnl-edit-generic-device');
            el.css({ display: 'inline-block' });
            $('<input type="hidden"></input>').appendTo(el).attr('data-bind', "id").attr('data-datatype', 'int');
        }
    });

    $.widget('pic.pnlDeviceDetails', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el[0].dataBind = function (dev) { self.dataBind(dev); }
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            $('.pnl-generic-device-details').empty();
            el.addClass('pnl-generic-device-details');
            templateBuilder.createObjectOptions(el, o.deviceType);
            self.dataBind();
            if (typeof o.id !== 'undefined'){
                var btnPnl = $('<div class="btn-panel"></div>').appendTo(el);
                $('<div></div>').appendTo(btnPnl).actionButton({ text: 'Save Device', icon: '<i class="fas fa-save"></i>' })
                .on('click', function (evt) { self.saveDevice(); });
                $('<div></div>').appendTo(btnPnl).actionButton({ id: "btnDeleteDevice", text: 'Delete Device', icon: '<i class="fas fa-trash"></i>' })
                .on('click', function (evt) { self.deleteDevice(); });
            }
        },
        saveDevice: function () {
            var self = this, o = self.options, el = self.element;
            if (dataBinder.checkRequired(el)) {
                var dev = dataBinder.fromElement(el);
                dev.id = o.id;
                console.log(dev);
                if (isNaN(dev.id)) delete dev.id;
                $.putLocalService('/config/genericDevices/device', dev, 'Saving Generic Device...', function (genDev, status, xhr) {
                    self.dataBind(genDev);
                    $.find('div.pnl-generic-devices-crud:first')[0].saveDevice(genDev);
                    //$.find('div.pnl-generic-devices-crud:first')[0].reloadGenericDevices();
                    //$('#pnl-edit-generic-device').remove();
                });
            }
        },
        deleteDevice: function () {
            var self = this, o = self.options, el = self.element;
            var dev = dataBinder.fromElement(el);
            dev.id = o.id;
            $.pic.modalDialog.createConfirm('dlgConfirmDeleteDevice', {
                message: '<div>Are you sure you want to delete generic device <b>' + dev.options.name + '</b>?</div><hr></hr><div><span style="color:red;font-weight:bold;">WARNING:</span> If you delete this device it will remove all <span style="font-weight:bold;">triggers and feeds</span> associated with this device.</div>',
                width: '350px',
                height: 'auto',
                title: 'Confirm Delete Device',
                buttons: [{
                    text: 'Yes', icon: '<i class="fas fa-trash"></i>',
                    click: function (evt) {
                        $.deleteLocalService('/config/genericDevices/device', dev, 'Deleting Generic Device...', function (genDev, status, xhr) {
                            self.dataBind({ id: '', isActive: false, typeId: 0 });
                            $.find('div.pnl-generic-devices-crud:first')[0].reloadGenericDevices();
                            $('#pnl-edit-generic-device').remove();
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
        dataBind: function (device) {
            var self = this, o = self.options, el = self.element;
            var genDevOptions = el.attr('data-id');
            if (typeof device !== 'undefined') {
                for (var prop in device) {
                    o[prop] = device[prop];
                }
            }
            console.log(o);
            if (typeof o.deviceType !== 'undefined') {
                el.parents('div.control-panel:first').find('div.control-panel-title').text(`Edit ${o.deviceType.name}`);
                el.attr('data-typeId', o.deviceType.id);
            }
            dataBinder.bind(el, o);
            el.attr('data-id', o.id);
        }
    });

    $.widget('pic.pnlDeviceTriggers', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (triggers) { self.dataBind(triggers); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-i2cdevice-triggers');
            $('<div></div>').appendTo(el).addClass('script-advanced-instructions').html('Triggers act upon input from other devices and are used as inputs for this i2c device.');
            $('<div></div>').appendTo(el).crudList({
                id: 'crudTriggers' + o.deviceId, actions: { canCreate: true, canEdit: true, canRemove: true },
                key: 'id',
                caption: 'Device Triggers', itemName: 'Device Triggers',
                columns: [{ binding: 'connection.name', text: 'Connection', style: { width: '157px' } }, { binding: 'sendValue', text: 'Value', style: { width: '127px' } }, { binding: 'propertyDesc', text: 'Property', style: { width: '247px' }, cellStyle: {} }]
            }).css({ width: '100%' })
                .on('additem', function (evt) {
                    $.getLocalService('/config/options/genericDevices/' + o.busNumber + '/' + o.address + '/triggers', null, function (triggers, status, xhr) {
                        triggers.trigger = { isActive: true };
                        self._createTriggerDialog('dlgAddI2cTrigger', 'Add Trigger to I2c Device', triggers);
                    });
                }).on('edititem', function (evt) {
                    $.getLocalService('/config/options/genericDevices/' + o.busId + '/' + o.address + '/triggers', null, function (triggers, status, xhr) {
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
                }).hide();
        },
        dataBind: function (triggers) {
            var self = this, o = self.options, el = self.element;
            var felem = el.find('div.crud-list:first').each(function () {
                this.clear();
                if (typeof triggers !== 'undefined') {
                    for (var i = 0; i < triggers.length; i++) {
                        var trigger = triggers[i];
                        this.addRow(trigger);
                    }
                }
            });
            o.triggers = triggers;
        }

    });
    $.widget('pic.pnlDeviceFeeds', {
        options: {},
        _create: function (device) {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (feeds) { self.dataBind(feeds); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-genericdevice-feeds').css({ maxWidth: '37rem' });
            $('<div></div>').appendTo(el).addClass('script-advanced-instructions').html('Feeds send values from the device via a connection to other software.  The defined connection determines the format, protocol, and potential data that is sent.');
            $('<div></div>').appendTo(el).crudList({
                id: 'crudFeeds' + o.deviceId, actions: { canCreate: true, canEdit: true, canRemove: true },
                key: 'id',
                caption: 'Device Value Feeds', itemName: 'Value Feeds',
                //columns: [{ binding: 'connection.name', text: 'Connection', style: { width: '157px' } }, { binding: 'sendValue', text: 'Value', style: { width: '127px' } }, { binding: 'propertyDesc', text: 'Property', style: { width: '247px' }, cellStyle: {} }]
                columns: [{ binding: 'connection.name', text: 'Connection', style: { width: '157px' } }, { binding: 'sendValue', text: 'Value', style: { width: '127px' } }, { binding: 'propertyDesc', text: 'Property', style: { width: '247px' }, cellStyle: {} }]
            }).css({ width: '100%' })
                .on('additem', function (evt) {
                    console.log(o);
                    $.getLocalService('/config/options/generic/' + o.id + '/feeds', null, function (feeds, status, xhr) {
                        feeds.feed = { isActive: true };
                        self._createFeedDialog('dlgAddGenericFeed', 'Add Feed to Generic Device', feeds);
                    });
                }).on('edititem', function (evt) {
                    $.getLocalService('/config/options/generic/' + o.id + '/feeds', null, function (feeds, status, xhr) {
                        feeds.feed = o.feeds.find(elem => elem.id == evt.dataKey);
                        
                        self._createFeedDialog('dlgEditGenericFeed', 'Edit Generic Device Feed', feeds);
                    });
                }).on('removeitem', function (evt) {
                    var dlg = $.pic.modalDialog.createConfirm('dlgConfirmDeleteGenericFeed', {
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
                                $.deleteLocalService('/config/generic/device/feed', feed, function (feeds, status, xhr) {
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
                                feed.deviceId = o.deviceId;
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
            $('<div></div>').appendTo(dlg).pnlDeviceFeedParams({ device: f.device });
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
            $.putLocalService('/config/generic/device/feed', feed, 'Saving Device Feed...', function (f, result, xhr) {
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
    $.widget('pic.pnlDeviceFeedParams', {
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
                            if (type === 'internal') {
                                line = $('<div></div>').appendTo(el);
                                $('<div></div>').appendTo(line).addClass('script-advanced-instructions').html('Enter plain javascript for the data to be transferred.  Return a string, number, or object from the function.');
                                line = $('<div></div>').appendTo(el);
                                $('<div></div>').appendTo(line).scriptEditor({ binding: 'payloadExpression', prefix: '(feed, value): any => {', suffix: '}', codeStyle: { maxHeight: '300px', overflow: 'auto' } });
                            }
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

})(jQuery);