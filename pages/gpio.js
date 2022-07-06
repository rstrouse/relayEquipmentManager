(function ($) {
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
                var overlays = {
                    spi0: data.controller.spi0.isActive,
                    spi1: data.controller.spi1.isActive,
                    i2c: data.controller.i2c.buses.length > 0
                };
                
                for (var ihead = 0; ihead < pinHeads.length; ihead++) {
                    var head = pinHeads[ihead];
                    $('<div></div>').appendTo(headers).pinHeader({ header: head, overlays: overlays, pins: data.controller.gpio.pins });

                }
                $('<div></div>').appendTo(el).pnlPinDefinition({ headers: headers, pinDirections: data.pinDirections });
                el.on('selchanged', 'div.pin-header', function (evt) {
                    // Bind up the gpio data from our set.
                    // Lets round trip to the server to get the data we need for the specific pin.
                    $.getLocalService('/config/options/gpio/pin/' + evt.headerId + '/' + evt.newPinId, null, function (pin, status, xhr) {
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
                    if (evt.currentTarget.disabled()) {
                        evt.stopPropagation();
                    }
                    else {
                        var pin = dataBinder.fromElement(pinDef);
                        pin.state = evt.currentTarget.val();
                        $.putLocalService('/state/setPinState', { gpioId: pin.gpioId, state: pin.state }, function (p, status, xhr) {
                            console.log(p);
                            evt.currentTarget.val(pin.state);
                        });
                    }
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
            $('<label></label>').appendTo(line).text('Label').css({ marginLeft:'2.25rem', width: '3.5rem', display: 'inline-block' });
            $('<span></span>').appendTo(line).attr('data-bind', 'pinoutName').attr('data-datatype', 'int');
            
            line = $('<div></div>').appendTo(pin);
            $('<div><div>').appendTo(line).inputField({ labelText: 'Name', binding: 'name', inputAttrs: { maxlength: 24 }, labelAttrs: { style: { width: '5rem' } } });
            line = $('<div></div>').appendTo(pin);
            $('<div></div>').appendTo(line).pickList({
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Direction', binding: 'direction',
                columns: [{ hidden: true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }, { binding: 'desc', text: 'Pin Direction', style: { width: '250px' } }],
                items: o.pinDirections, inputAttrs: { style: { width: '7rem' } }, labelAttrs: { style: { width: '5rem' } }
            }).on('selchanged', function (evt) {
                // If we are an input we need to show the debounce stuff.
                if (evt.newItem.name === 'input') {
                    pin.find('div.pnl-input-params').show();
                    pin.find('div.pnl-output-params').hide();
                    el.find('div#tabsGpioPin').each(function () {
                        this.showTab('tabPinTriggers', false);
                        this.selectTabById('tabPinFeeds');
                    });
                }
                else {
                    pin.find('.pnl-input-params').hide();
                    pin.find('.pnl-output-params').show();
                    el.find('div#tabsGpioPin').each(function () {
                        this.showTab('tabPinTriggers', true);
                    });
                }
            });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Inverted', bind: 'isInverted' });
            line = $('<div></div>').appendTo(pin).addClass('pnl-output-params');
            $('<div></div>').appendTo(line).pickList({
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Startup State', binding: 'initialState',
                columns: [{ hidden: true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }, { binding: 'desc', text: 'Pin Direction', style: { width: '250px' } }],
                items: [{ name: 'on', desc: 'On' }, { name: 'off', desc: 'Off'}, { name: 'last', desc: 'Last State' }], inputAttrs: { style: { width: '7rem' } }, labelAttrs: { style: { width: '7rem' } }
            });
            line = $('<div></div>').appendTo(pin).addClass('pnl-output-params');
            let grp = $('<fieldset></fieldset>').appendTo(line);
            $('<legend></legend>').appendTo(grp).text('Sequence Delays');
            $('<div></div>').appendTo(grp).html(`Use the delay settings below to add a delay for relay on/off sequences.  This will insert an additional delay time to ensure the relay does not cycle too fast.`).addClass('script-advanced-instructions').css({ maxWidth: '17rem' });
            line = $('<div></div>').appendTo(grp);

            $('<div></div>').appendTo(grp).valueSpinner({
                required: false, canEdit: true, binding: 'sequenceOnDelay', labelText: 'On Delay', fmtMask: '#,##0', dataType: 'number', step: 1,
                min: 0, max: 10000, units: `ms`, inputAttrs: { style: { width: '4rem' } }, labelAttrs: { style: { width: '5rem' } }
            });
            line = $('<div></div>').appendTo(grp);
            $('<div></div>').appendTo(line).valueSpinner({
                required: false, canEdit: true, binding: 'sequenceOffDelay', labelText: 'Off Delay', fmtMask: '#,##0', dataType: 'number', step: 1,
                min: 0, max: 10000, units: `ms`, inputAttrs: { style: { width: '4rem' } }, labelAttrs: { style: { width: '5rem' } }
            });

            line = $('<div></div>').appendTo(pin).addClass('pnl-input-params').hide();
            $('<div></div>').appendTo(line).valueSpinner({
                required: true, canEdit: true, binding: 'debounceTimeout', labelText: 'Debounce', fmtMask: '#,##0', dataType: 'number', step: 1,
                min: 0, max: 10000, units: `ms`, inputAttrs: { style: { width: '4rem' } }, labelAttrs: { style: { width: '5rem' } }
            });
            $('<hr></hr>').appendTo(outer);
            // So lets set up a tabBar.
            var tabs = $('<div></div>').appendTo(outer).tabBar({ id: 'tabsGpioPin' }).on('tabchange', function(evt) { evt.stopPropagation() });
            $('<div></div>').appendTo(tabs[0].addTab({ id: 'tabPinTriggers', text: 'Triggers' })).pnlPinTriggers();
            $('<div></div>').appendTo(tabs[0].addTab({ id: 'tabPinFeeds', text: 'Feeds' })).pnlPinFeeds();
            tabs[0].selectTabById('tabPinTriggers');

            //var trigs = $('<div></div>').appendTo(el);
            //$('<div></div>').appendTo(trigs).pnlPinTriggers().hide();
            //var feeds = $('<div></div>').appendTo(el);
            //$('<div></div>').appendTo(feeds).pnlPinFeeds().hide();
            $('<div></div>').appendTo(el).addClass('select-pin-message').text('Select a pin from the displayed header(s) to edit its defintion');
            var btnPnl = $('<div class="btn-panel"></div>').appendTo(el).hide();
            $('<div></div>').appendTo(btnPnl).actionButton({ text: 'Save Pin', icon: '<i class="fas fa-save"></i>' })
                .on('click', function (evt) {
                    var pin = dataBinder.fromElement(pinDef);
                    console.log(pin);
                    // Send this off to the service.
                    $.putLocalService('/config/gpio/pin/' + pin.header.id + '/' + pin.id, pin, 'Saving Pin Settings...', function (p, status, xhr) {
                        self.dataBind({ pin: p });
                    });
                });
        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            el.find('div.pnl-pin-outer').each(function () { dataBinder.bind($(this), data.pin); });
            el.find('div.pnl-pin-triggers').each(function () { this.dataBind(data); });
            el.find('div.pnl-pin-feeds').each(function () { this.dataBind(data); });
            if (typeof data.pin === 'undefined' || typeof data.pin.id === 'undefined' || data.pin.id === 0) {
                el.find('div.pin-definition').hide();
                el.find('div.select-pin-message').show();
                el.find('div.btn-panel').hide();
                el.find('div.pnl-pin-triggers').hide();
                el.find('div.pnl-pin-feeds').hide();
            }
            else {
                el.find('div.pin-definition').show();
                el.find('div.select-pin-message').hide();
                el.find('div.pnl-pin-triggers').show();
                el.find('div.btn-panel').show();
                el.find('div.pnl-pin-feeds').show();
            }
            if (typeof data.pin === 'undefined' || !makeBool(data.pin.isExported)) {
                el.find('div.pin-state-panel').hide().find('div.picToggleButton').attr('data-gpioid', '').val(false);
            }
            else {
                var sval = makeBool(data.pin.state.name);
                el.find('div.pin-state-panel').show().find('div.picToggleButton').attr('data-gpioid', data.pin.gpioId)[0].val(sval);
            }
            if (typeof data.pin.gpioId !== 'undefined') el.find('div#divGPIOIdLine').show();
            else el.find('div#divGPIOLine').hide();
            if (data.pin.isActive) el.find('div#btnPinState').show();
            else el.find('div#btnPinState').hide();
            el.find('div#btnPinState').each(function () {
                this.disabled(data.pin.direction === 'input');
            });
            el.find('div#tabsGpioPin').each(function () {
                this.showTab('tabPinTriggers', data.pin.direction !== 'input');
                if (data.pin.direction === 'input') this.selectTabById('tabPinFeeds');
            });
            // Find the pin header and set the label.
            el.parents(`div.config-gpio`).find(`div.gpio-headers > div.pin-header[data-id=${data.pin.headerId}]`)
                .each(function () {
                    this.pinLabel(data.pin.id, data.pin.name);
                    this.pinActive(data.pin.id, data.pin.isActive);
                });
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
                                $.putLocalService('/config/gpio/pin/trigger/' + trig.pin.headerId + '/' + trig.pin.id, trigger, 'Saving Trigger...', function (t, status, xhr) {
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
                columns: [{ hidden: true, binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap', width: '77px' } }, { binding: 'desc', text: 'State', style: { minWidth: '77px' } }, { binding: 'inst', text: 'Description', style: { whiteSpace:'nowrap', minWidth: '227px' } }],
                items: trig.triggerStates, inputAttrs: { style: { width: '5rem' } }, labelAttrs: { style: { width: '7rem' } }
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
                id: 'crudTriggers', actions: { canCreate: true, canEdit: true, canRemove: true },
                key: 'id',
                caption: 'Triggers', itemName: 'Pin Trigger',
                columns: [{ binding: 'state.desc', text: 'State', style: { width: '47px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                    { binding: 'connection.name', text: 'Connection', style: { width: '157px' } },
                    { binding: 'eventName', text: 'Event', style: { width: '127px' } },
                    { binding: 'filter', text: 'Filter', style: { width: '197px' }, cellStyle: { fontSize: '8pt', whiteSpace: 'nowrap' } }]
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
                            $.deleteLocalService('/config/gpio/pin/trigger/' + p.pin.headerId + '/' + p.pin.id + '/' + evt.dataKey, {}, 'Deleting Trigger...', function (c, status, xhr) {
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
            $.getLocalService('/config/options/gpio/pin/' + p.pin.headerId + '/' + p.pin.id, null, function (opts, status, xhr) {
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
                        else if (type === 'mqttClient') {
                            $('<div></div>').appendTo(line).inputField({
                                required: true, binding: 'eventName', labelText: "Topic", inputAttrs: { style: { width: '14rem' } }, labelAttrs: { style: { width: '7rem' } }
                            });
                            // We need to add in the expression for the 
                        }
                        else {
                            $('<div></div>').appendTo(line).inputField({
                                required: true, binding: 'eventName', labelText: "Event Name", inputAttrs: { style: { width: '7rem' } }, labelAttrs: { style: { width: '7rem' } }
                            });
                        }
                        $('<hr></hr>').appendTo(el);
                        var tabBar = $('<div></div>').appendTo(el).tabBar();
                        {
                            // Add in the basic filters.
                            var basic = tabBar[0].addTab({ id: 'tabBasic', text: 'Basic Filters' });
                            var pnl = $('<div></div>').addClass('pnl-trigger-basic-bindings').appendTo(basic);
                        }
                        {
                            var advanced = tabBar[0].addTab({ id: 'tabAdvanced', text: 'Filter Expression' });
                            var pnl = $('<div></div>').addClass('pnl-trigger-advanced-bindings').appendTo(advanced);
                            $('<div></div>').appendTo(pnl).addClass('script-advanced-instructions').html('Enter plain javascript for the filter expression below.  If you do not want to filter this trigger, then leave the expression blank.  Each of the parameter inputs (connection, trigger, pin, and data) are available within the filter function.  Use return <span style=\"font-weight:bold;\">true.</span> from the filter function to apply the trigger state.');
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
                $('<div></div>').appendTo(line).checkbox({ labelText: bind.binding, bind: binding + '.isActive', style: { whiteSpace: 'nowrap', minWidth: '7rem' }, labelAttrs: { style: { marginRight: '.25rem' } } }).on('changed', function (evt) {
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
    $.widget('pic.pnlPinFeeds', {
        options: {},
        _create: function (device) {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (feeds) { self.dataBind(feeds); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-pin-feeds');
            $('<div></div>').appendTo(el).addClass('script-advanced-instructions').html('Feeds send values from the device via a connection to other software.  The defined connection determines the format, protocol, and potential data that is sent.').css({ maxWidth: '37rem' });
            $('<div></div>').appendTo(el).crudList({
                id: 'crudFeeds', actions: { canCreate: true, canEdit: true, canRemove: true },
                key: 'id',
                caption: 'Device Value Feeds', itemName: 'Value Feeds',
                columns: [{ binding: 'connection.name', text: 'Connection', style: { width: '157px' } }, { binding: 'sendValue', text: 'Value', style: { width: '127px' } }, { binding: 'propertyDesc', text: 'Property', style: { width: '247px' }, cellStyle: {} }]
            })
                .on('additem', function (evt) {
                    $.getLocalService('/config/options/gpio/pin/feeds/' + o.headerId + '/' + o.pinId, null, function (feeds, status, xhr) {
                        feeds.feed = { isActive: true };
                        self._createFeedDialog('dlgAddGPIOFeed', 'Add Feed to GPIO Device', feeds);
                    });
                }).on('edititem', function (evt) {
                    $.getLocalService('/config/options/gpio/pin/feeds/' + o.headerId + '/' + o.pinId, null, function (feeds, status, xhr) {
                        feeds.feed = feeds.feeds.find(elem => elem.id == evt.dataKey);
                        self._createFeedDialog('dlgEditGPIOFeed', 'Edit GPIO Device Feed', feeds);
                    });
                }).on('removeitem', function (evt) {
                    var p = dataBinder.fromElement(el);
                    var dlg = $.pic.modalDialog.createConfirm('dlgConfirmDeleteGPIOFeed', {
                        message: 'Are you sure you want to delete Feed?',
                        width: '350px',
                        height: 'auto',
                        title: 'Confirm Delete Device Feed',
                        buttons: [{
                            text: 'Yes', icon: '<i class="fas fa-trash"></i>',
                            click: function () {
                                var feed = {
                                    headerId: o.headerId,
                                    pinId: o.pinId,
                                    id: evt.dataKey
                                };
                                $.deleteLocalService('/config/gpio/pin/feed', feed, function (feeds, status, xhr) {
                                    $.pic.modalDialog.closeDialog(dlg);
                                    // self.dataBind(feeds)
                                    self.reloadFeeds();
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
                                feed.pinId = o.pinId;
                                feed.headerId = o.headerId;
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
                    dlg.find('div.pnl-gpio-feed-params').each(function () { this.setConnection(evt.newItem); });
                });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Is Active', binding: 'isActive', value: true });
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).pickList({
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Send Value', binding: 'sendValue',
                columns: [{ binding: 'name', text: 'Name', style: { maxWidth: '197px' } }, { binding: 'desc', text: 'Type', style: { minWidth: '347px' } }],
                items: [{ name: 'state', desc: 'State of the Pin', type: 'boolean' }], inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }

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
            $('<div></div>').appendTo(dlg).pnlGpioFeedParams({ device: f.device });
            if (typeof f.feed.id !== 'undefined') {
                conn[0].disabled(true);
                dlg.find('div.pnl-gpio-feed-params').each(function () { this.dataBind(f.feed); });
                dataBinder.bind(dlg, f.feed);
            }
            dlg.css({ overflow: 'visible' });
            return dlg;
        },
        saveFeed: function (feed) {
            var self = this, o = self.options, el = self.element;
            $.putLocalService('/config/gpio/pin/feed', feed, 'Saving Device Feed...', function (f, result, xhr) {
                self.reloadFeeds();
            });
        },
        reloadFeeds: function() {
            var self = this, o = self.options, el = self.element;
            $.getLocalService('/config/options/gpio/pin/' + o.headerId + '/' + o.pinId, null, function (pin, status, xhr) {
                // Find the pin definition from the header.
                console.log(pin);
                self.dataBind(pin);
            });
        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            dataBinder.bind(el, data);
            var felem = el.find('div#crudFeeds:first').each(function () {
                this.clear();
                for (var i = 0; i < data.pin.feeds.length; i++) {
                    var feed = data.pin.feeds[i];
                    this.addRow(feed);
                }
            });
            o.headerId = data.pin.headerId;
            o.pinId = data.pin.id;
        }
    });
    $.widget('pic.pnlGpioFeedParams', {
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
            el.addClass('pnl-gpio-feed-params');
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
                        console.log({ msg: 'Binding Feed', data: data });
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