$(function() {
    function ControlViewModel(parameters) {
        var self = this;
        
        self.loginState = parameters[0];
        self.settings = parameters[1];

        self.xActualPosition = ko.observable(0.00);
        self.yActualPosition = ko.observable(0.00);
        self.zActualPosition = ko.observable(0.00);
        self.eActualPosition = ko.observable(0.00);




        self._createToolEntry = function () {
            return {
                name: ko.observable(),
                key: ko.observable(),
                actual: ko.observable(0),
                target: ko.observable(0),
                offset: ko.observable(0),
                newTarget: ko.observable(),
                newOffset: ko.observable(),
                pressure: ko.observable(0),
                xPosition: ko.observable(0),
                yPosition: ko.observable(0),
                zPosition: ko.observable(0), 
                ePosition: ko.observable(0),
                temperature: ko.observable(0),
                pressure: ko.observable(0),
                entryNames: ko.observableArray([]),
                targetPressure: ko.observable()
            }
        };

        self.wellplateSelected = ko.observable(false);
        self.log = ko.observableArray([]);
        self.buffer = ko.observable(300);

        self.command = ko.observable(undefined);

        self.isErrorOrClosed = ko.observable(undefined);
        self.isOperational = ko.observable(undefined);
        self.isPrinting = ko.observable(undefined);
        self.isPaused = ko.observable(undefined);
        self.isError = ko.observable(undefined);
        self.isReady = ko.observable(undefined);
        self.isLoading = ko.observable(undefined);

        self.extrusionAmount = ko.observable(undefined);
        self.controls = ko.observableArray([]);

        self.extruder1Pressure = ko.observable(undefined);
        self.extruder1Temp = ko.observable(undefined);
        self.extruder1TempTarget = ko.observable(undefined);
        self.extruder1XPos = -1;
        self.extruder1YPos = -1;
        self.extruder1EPos = 46;
        self.extruder1ZPos = -1;
        self.extruder1Selected = ko.observable(false);
        self.extruder1Extruding = ko.observable(false);

        self.extruder2Pressure = ko.observable(undefined);
        self.extruder2Temp = ko.observable(undefined);
        self.extruder2TempTarget = ko.observable(undefined);
        self.extruder2XPos = -1;
        self.extruder2YPos = -1;
        self.extruder2EPos = 0;
        self.extruder2ZPos = -1;
        self.extruder2Selected = ko.observable(false);
        self.extruder2Extruding = ko.observable(false);

        self.lightIntensity = ko.observable(0);
        self.lightOn = ko.observable(false);

        self.cl_layers_enabled = ko.observable(false);
        self.cl_layers = ko.observable(0);
        self.cl_intensity = ko.observable(0);
        self.cl_duration = ko.observable(0);
        self.cl_end = ko.observable(false);
        self.cl_end_intensity = ko.observable(0);
        self.cl_end_duration = ko.observable(0);

        self.isHomed = ko.observable(false);
        self.homed = {
            'x,y': false,
            'z': false,
            'e': false
        }

        self.wellPlate = ko.observable(1);
        self.wellPlatePositions = {
            '6': {
                'X': 18.00,
                'Y': 70.2
            },
            '12': {
                'X': 18.40,
                'Y': 62.90
            },
            '24': {
                'X': 33.3,
                'Y': 193.5
            },
            '96': {
                'X': 8.10,
                'Y': 58.30
            }
        }

        self.position = {}
        
    
        self.midpoint = 22;
        self.xTravel = 48.33;

        self.tools = ko.observableArray([self._createToolEntry(), self._createToolEntry()]);
        self.hasBed = ko.observable(true);
        // self.bedTemp = self._createToolEntry();
        // self.bedTemp["name"](gettext("Bed"));
        // self.bedTemp["key"]("bed");

        self.temperature_profiles = self.settings.temperature_profiles;
        self.temperature_cutoff = self.settings.temperature_cutoff;

        self.heaterOptions = ko.observable({});

        self.feedRate = ko.observable(100);
        self.flowRate = ko.observable(100);

        self.feedbackControlLookup = {};

        self.controlsFromServer = [];
        self.additionalControls = [];

        self.webcamDisableTimeout = undefined;

        self.templates = ['PCL', 'Pluronic'];

        self.keycontrolActive = ko.observable(false);
        self.keycontrolHelpActive = ko.observable(false);
        self.keycontrolPossible = ko.computed(function () {
            return self.isOperational() && !self.isPrinting() && self.loginState.isUser() && !$.browser.mobile;
        });
        self.showKeycontrols = ko.computed(function () {
            return self.keycontrolActive() && self.keycontrolPossible();
        });

        self._updateExtruderCount = function () {
            var graphColors = ["red", "orange", "green", "brown", "purple"];
            var heaterOptions = {};
            var tools = self.tools();

            var numExtruders = self.settings.printerProfiles.currentProfileData().extruder.count();
            if (numExtruders > 1) {
                // multiple extruders
                heaterOptions["tool0"] = {name: "T0", color: "red"};
                heaterOptions["tool1"] = {name: "T1", color: "black"};

                tools[0] = self._createToolEntry();
                tools[0]["name"](gettext("Extruder 1"));
                tools[0]["key"]("tool0")

                tools[1] = self._createToolEntry();
                tools[1]["name"](gettext("Extruder 2"));
                tools[1]["key"]("tool1")

            } else {
                // only one extruder, no need to add numbers
                var color = graphColors[0];
                heaterOptions["tool0"] = {name: "T", color: color};

                tools[0] = self._createToolEntry();
                tools[0]["name"](gettext("Hotend"));
                tools[0]["key"]("tool0");
            }
            heaterOptions["bed"] = {name: gettext("Bed"), color: "blue"};

            self.heaterOptions(heaterOptions);
            self.tools(tools);
        };
        self.settings.printerProfiles.currentProfileData.subscribe(function () {
            self._updateExtruderCount();

            self.settings.printerProfiles.currentProfileData().extruder.count.subscribe(self._updateExtruderCount);
        });

        self.temperatures = [];
        self.plotOptions = {
            yaxis: {
                min: 0,
                max: 310,
                ticks: 10
            },
            xaxis: {
                mode: "time",
                minTickSize: [2, "minute"],
                tickFormatter: function(val, axis) {
                    if (val == undefined || val == 0)
                        return ""; // we don't want to display the minutes since the epoch if not connected yet ;)

                    // current time in milliseconds in UTC
                    var timestampUtc = Date.now();

                    // calculate difference in milliseconds
                    var diff = timestampUtc - val;

                    // convert to minutes
                    var diffInMins = Math.round(diff / (60 * 1000));
                    if (diffInMins == 0)
                        return gettext("just now");
                    else
                        return "- " + diffInMins + " " + gettext("min");
                }
            },
            legend: {
                position: "sw",
                noColumns: 2,
                backgroundOpacity: 0
            }
        };

         self.autoscrollEnabled = ko.observable(true);

        self.filters = self.settings.terminalFilters;
        self.filterRegex = ko.observable();

        self.cmdHistory = [];
        self.cmdHistoryIdx = -1;

        self.displayedLines = ko.computed(function() {
            var regex = self.filterRegex();
            var lineVisible = function(entry) {
                return regex == undefined || !entry.line.match(regex);
            };

            var filtered = false;
            var result = [];
            _.each(self.log(), function(entry) {
                if (lineVisible(entry)) {
                    result.push(entry);
                    filtered = false;
                } else if (!filtered) {
                    result.push(self._toInternalFormat("[...]", "filtered"));
                    filtered = true;
                }
            });

            return result;
        });
        self.displayedLines.subscribe(function() {
            self.updateOutput();
        });

        self.lineCount = ko.computed(function() {
            var total = self.log().length;
            var displayed = _.filter(self.displayedLines(), function(entry) { return entry.type == "line" }).length;
            var filtered = total - displayed;

            if (total == displayed) {
                return _.sprintf(gettext("showing %(displayed)d lines"), {displayed: displayed});
            } else {
                return _.sprintf(gettext("showing %(displayed)d lines (%(filtered)d of %(total)d total lines filtered)"), {displayed: displayed, total: total, filtered: filtered});
            }
        });

        self.autoscrollEnabled.subscribe(function(newValue) {
            if (newValue) {
                self.log(self.log.slice(-self.buffer()));
            }
        });

        self.activeFilters = ko.observableArray([]);
        self.activeFilters.subscribe(function(e) {
            self.updateFilterRegex();
        });


        self.extruderEntries = {};


        self.fromCurrentData = function (data) {
            self._processStateData(data.state);
            self._processPositionData(data.position);

            self._processTemperatureUpdateData(data.serverTime, data.temps);
            self._processOffsetData(data.offsets);
            self._processCurrentLogData(data.logs);
        };

        self.fromHistoryData = function (data) {
            self._processStateData(data.state);
            self._processTemperatureHistoryData(data.serverTime, data.temps);
            self._processOffsetData(data.offsets);
            self._processHistoryLogData(data.logs);
        };

        self._processStateData = function (data) {
            self.isErrorOrClosed(data.flags.closedOrError);
            self.isOperational(data.flags.operational);
            self.isPaused(data.flags.paused);
            self.isPrinting(data.flags.printing);
            self.isError(data.flags.error);
            self.isReady(data.flags.ready);
            self.isLoading(data.flags.loading);
        };

        self._processPositionData = function(data) {
            self.position = data;
            if (data != null) { 
                self.xActualPosition(data['X']);
                self.yActualPosition(data['Y']);
                self.zActualPosition(data['Z']);
                self.eActualPosition(data['E']);
            } else {
                self.xActualPosition(0);
                self.yActualPosition(0);
                self.zActualPosition(0);
                self.eActualPosition(0);
            }
        }

        self._processCurrentLogData = function(data) {
            self.log(self.log().concat(_.map(data, function(line) { return self._toInternalFormat(line) })));
            if (self.autoscrollEnabled()) {
                self.log(self.log.slice(-self.buffer()));
            }
        };

        self._processTemperatureUpdateData = function(serverTime, data) {
            if (data.length == 0)
                return;

            var lastData = data[data.length - 1];

            var tools = self.tools();

            if (lastData.hasOwnProperty("tool0") && lastData.hasOwnProperty("bed")) {
                tools[0].actual(lastData["tool0"].actual);
                tools[0].target(lastData["tool0"].target);
                tools[0].pressure(lastData["bed"].actual);
            }

            if (lastData.hasOwnProperty("tool1") && lastData.hasOwnProperty("tool2")) {
                tools[1].actual(lastData["tool1"].actual);
                tools[1].target(lastData["tool1"].target);
                tools[1].pressure(lastData["tool2"].actual);   
            }

            if (!CONFIG_TEMPERATURE_GRAPH) return;

            self.temperatures = self._processTemperatureData(serverTime, data, self.temperatures);
            self.updatePlot();
        };

        self._processHistoryLogData = function(data) {
            self.log(_.map(data, function(line) { return self._toInternalFormat(line) }));
        };

        self._processTemperatureHistoryData = function(serverTime, data) {
            self.temperatures = self._processTemperatureData(serverTime, data);
            self.updatePlot();
        };

        self._toInternalFormat = function(line, type) {
            if (type == undefined) {
                type = "line";
            }
            return {line: line, type: type}
        };

        self._processOffsetData = function(data) {
            var tools = self.tools();
            for (var i = 0; i < tools.length; i++) {
                if (data.hasOwnProperty("tool" + i)) {
                    tools[i]["offset"](data["tool" + i]);
                }
            }

            // if (data.hasOwnProperty("bed")) {
            //     self.bedTemp["offset"](data["bed"]);
            // }
        };

        self._processTemperatureData = function(serverTime, data, result) {
            var types = _.keys(self.heaterOptions());
            var clientTime = Date.now();

            // make sure result is properly initialized
            if (!result) {
                result = {};
            }

            result['tool0'] = {actual: [], target: []};
            result['tool1'] = {actual: [], target: []};


            // convert data
            _.each(data, function(d) {
                var timeDiff = (serverTime - d.time) * 1000;
                var time = clientTime - timeDiff;
                result['tool0'].actual.push([time, d['tool0'].actual]);
                result['tool0'].target.push([time, d['tool0'].target]);

                result['tool1'].actual.push([time, d['tool1'].actual]);
                result['tool1'].target.push([time, d['tool1'].target]);
            });

            var filterOld = function(item) {
                return item[0] >= clientTime - self.temperature_cutoff() * 60 * 1000;
            };

            result['tool0'].actual = _.filter(result['tool0'].actual, filterOld);
            result['tool0'].target = _.filter(result['tool0'].target, filterOld);

            result['tool1'].actual = _.filter(result['tool1'].actual, filterOld);
            result['tool1'].target = _.filter(result['tool1'].target, filterOld);

            return result;
        };

        self.updatePlot = function() {
            var graph = $("#temperature-graph");
            if (graph.length) {
                var data = [];
                var heaterOptions = self.heaterOptions();
                if (!heaterOptions) return;

                _.each(_.keys(heaterOptions), function(type) {
                    if (type == "bed" && !self.hasBed()) {
                        return;
                    }

                    var actuals = [];
                    var targets = [];

                    if (self.temperatures[type]) {
                        actuals = self.temperatures[type].actual;
                        targets = self.temperatures[type].target;
                    }

                    var actualTemp = actuals && actuals.length ? formatTemperature(actuals[actuals.length - 1][1]) : "-";
                    var targetTemp = targets && targets.length ? formatTemperature(targets[targets.length - 1][1]) : "-";

                    data.push({
                        label: gettext("Actual") + " " + heaterOptions[type].name + ": " + actualTemp,
                        color: heaterOptions[type].color,
                        data: actuals
                    });
                    data.push({
                        label: gettext("Target") + " " + heaterOptions[type].name + ": " + targetTemp,
                        color: pusher.color(heaterOptions[type].color).tint(0.5).html(),
                        data: targets
                    });
                });

                $.plot(graph, data, self.plotOptions);
            }
        };

        self.setTarget = function(item) {
            var value = item.newTarget();
            if (!value) return;

            self._sendToolCommand("target",
                item.key(),
                item.newTarget(),
                function() {item.newTarget("");}
            );
        };

        self.setTargetFromProfile = function(item, profile) {
            if (!profile) return;

            var value = undefined;
            if (item.key() == "bed") {
                value = profile.bed;
            } else {
                value = profile.extruder;
            }

            self._sendToolCommand("target",
                item.key(),
                value,
                function() {item.newTarget("");}
            );
        };

        self.setTargetToZero = function(item) {
            self._sendToolCommand("target",
                item.key(),
                0,
                function() {item.newTarget("");}
            );
        };

        self.setOffset = function(item) {
            self._sendToolCommand("offset",
                item.key(),
                item.newOffset(),
                function() {item.newOffset("");}
            );
        };


        self.set_clParams = function(){
            
            var cl_params = {
                "cl_layers_enabled": self.cl_layers_enabled(),
                "cl_layers": parseInt(self.cl_layers()),
                "cl_intensity": (parseFloat(self.cl_intensity()) / 100) * 75,
                "cl_duration": parseInt(self.cl_duration()),
                "cl_end": self.cl_end(),
                "cl_end_intensity": (parseFloat(self.cl_end_intensity()) / 100) * 75,
                "cl_end_duration": parseInt(self.cl_end_duration())
            }


            self.sendToolCommand({
                "command": "crosslink",
                "cl_params" : cl_params
            });
        };

        self.layers_clText = function() {
            if (self.cl_layers_enabled()) {
                return "Disable";
            } else {
                return "Enable";
            }
        }

        self.end_clText = function() {
            if (self.cl_end()) {
                return "Disable"
            } else {
                return "Enable"
            }
        }
        
        self._sendToolCommand = function(command, type, temp, successCb, errorCb) {
            var data = {
                command: command
            };

            var endpoint;
            if (type == "bed") {
                if ("target" == command) {
                    data["target"] = parseInt(temp);
                } else if ("offset" == command) {
                    data["offset"] = parseInt(temp);
                } else {
                    return;
                }

                endpoint = "bed";
            } else {
                var group;
                if ("target" == command) {
                    group = "targets";
                } else if ("offset" == command) {
                    group = "offsets";
                } else {
                    return;
                }
                data[group] = {};
                data[group][type] = parseInt(temp);

                endpoint = "tool";
            }

            $.ajax({
                url: API_BASEURL + "printer/" + endpoint,
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify(data),
                success: function() { if (successCb !== undefined) successCb(); },
                error: function() { if (errorCb !== undefined) errorCb(); }
            });

        };

        self.updateFilterRegex = function() {
            var filterRegexStr = self.activeFilters().join("|").trim();
            if (filterRegexStr == "") {
                self.filterRegex(undefined);
            } else {
                self.filterRegex(new RegExp(filterRegexStr));
            }
            self.updateOutput();
        };

        self.updateOutput = function() {
            if (self.autoscrollEnabled()) {
                self.scrollToEnd();
            }
        };

        self.toggleAutoscroll = function() {
            self.autoscrollEnabled(!self.autoscrollEnabled());
        };

        self.selectAll = function() {
            var container = $("#terminal-output");
            if (container.length) {
                container.selectText();
            }
        };

        self.scrollToEnd = function() {
            var container = $("#terminal-output");
            if (container.length) {
                container.scrollTop(container[0].scrollHeight - container.height())
            }
        };

        self.sendCommand = function() {
            var command = self.command();
            if (!command) {
                return;
            }

            var re = /^([gmt][0-9]+)(\s.*)?/;
            var commandMatch = command.match(re);
            if (commandMatch != null) {
                command = commandMatch[1].toUpperCase() + ((commandMatch[2] !== undefined) ? commandMatch[2] : "");
            }

            if (command) {
                $.ajax({
                    url: API_BASEURL + "printer/command",
                    type: "POST",
                    dataType: "json",
                    contentType: "application/json; charset=UTF-8",
                    data: JSON.stringify({"command": command})
                });

                self.cmdHistory.push(command);
                self.cmdHistory.slice(-300); // just to set a sane limit to how many manually entered commands will be saved...
                self.cmdHistoryIdx = self.cmdHistory.length;
                self.command("");
            }
        };

        self.fakeAck = function() {
            $.ajax({
                url: API_BASEURL + "connection",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({"command": "fake_ack"})
            });
        };

        self.handleKeyDown = function(event) {
            var keyCode = event.keyCode;

            if (keyCode == 38 || keyCode == 40) {
                if (keyCode == 38 && self.cmdHistory.length > 0 && self.cmdHistoryIdx > 0) {
                    self.cmdHistoryIdx--;
                } else if (keyCode == 40 && self.cmdHistoryIdx < self.cmdHistory.length - 1) {
                    self.cmdHistoryIdx++;
                }

                if (self.cmdHistoryIdx >= 0 && self.cmdHistoryIdx < self.cmdHistory.length) {
                    self.command(self.cmdHistory[self.cmdHistoryIdx]);
                }

                // prevent the cursor from being moved to the beginning of the input field (this is actually the reason
                // why we do the arrow key handling in the keydown event handler, keyup would be too late already to
                // prevent this from happening, causing a jumpy cursor)
                return false;
            }

            // do not prevent default action
            return true;
        };

        self.handleKeyUp = function(event) {
            if (event.keyCode == 13) {
                self.sendCommand();
            }

            // do not prevent default action
            return true;
        };

        self.onAfterTabChange = function(current, previous) {
            if (current != "#control") {
                return;
            }
            if (self.autoscrollEnabled()) {
                self.scrollToEnd();
            }
        };

        self.handleEnter = function(event, type, item) {
            if (event.keyCode == 13) {
                if (type == "target") {
                    self.setTarget(item);
                } else if (type == "offset") {
                    self.setOffset(item);
                } else if (type == "cl_params") {
                    self.set_clParams();
                }
            }
        };

        self.onEventSettingsUpdated = function (payload) {
            self.requestData();
        };

        self.onEventRegisteredMessageReceived = function(payload) {
            if (payload.key in self.feedbackControlLookup) {
                var outputs = self.feedbackControlLookup[payload.key];
                _.each(payload.outputs, function(value, key) {
                    if (outputs.hasOwnProperty(key)) {
                        outputs[key](value);
                    }
                });
            }
        };

        self.rerenderControls = function () {
            var allControls = self.controlsFromServer.concat(self.additionalControls);
            self.controls(self._processControls(allControls))
        };

        self.requestData = function () {
            $.ajax({
                url: API_BASEURL + "printer/command/custom",
                method: "GET",
                dataType: "json",
                success: function (response) {
                    self._fromResponse(response);
                }
            });
        };

        self._fromResponse = function (response) {
            self.controlsFromServer = response.controls;
            self.rerenderControls();
        };

        self._processControls = function (controls) {
            for (var i = 0; i < controls.length; i++) {
                controls[i] = self._processControl(controls[i]);
            }
            return controls;
        };

        self._processControl = function (control) {
            if (control.hasOwnProperty("processed") && control.processed) {
                return control;
            }

            if (control.hasOwnProperty("template") && control.hasOwnProperty("key") && control.hasOwnProperty("template_key") && !control.hasOwnProperty("output")) {
                control.output = ko.observable(control.default || "");
                if (!self.feedbackControlLookup.hasOwnProperty(control.key)) {
                    self.feedbackControlLookup[control.key] = {};
                }
                self.feedbackControlLookup[control.key][control.template_key] = control.output;
            }

            if (control.hasOwnProperty("children")) {
                control.children = ko.observableArray(self._processControls(control.children));
                if (!control.hasOwnProperty("layout") || !(control.layout == "vertical" || control.layout == "horizontal" || control.layout == "horizontal_grid")) {
                    control.layout = "vertical";
                }

                if (!control.hasOwnProperty("collapsed")) {
                    control.collapsed = false;
                }
            }

            if (control.hasOwnProperty("input")) {
                var attributeToInt = function(obj, key, def) {
                    if (obj.hasOwnProperty(key)) {
                        var val = obj[key];
                        if (_.isNumber(val)) {
                            return val;
                        }

                        var parsedVal = parseInt(val);
                        if (!isNaN(parsedVal)) {
                            return parsedVal;
                        }
                    }
                    return def;
                };

                _.each(control.input, function (element) {
                    if (element.hasOwnProperty("slider") && _.isObject(element.slider)) {
                        element.slider["min"] = attributeToInt(element.slider, "min", 0);
                        element.slider["max"] = attributeToInt(element.slider, "max", 255);

                        // try defaultValue, default to min
                        var defaultValue = attributeToInt(element, "default", element.slider.min);

                        // if default value is not within range of min and max, correct that
                        if (!_.inRange(defaultValue, element.slider.min, element.slider.max)) {
                            // use bound closer to configured default value
                            defaultValue = defaultValue < element.slider.min ? element.slider.min : element.slider.max;
                        }

                        element.value = ko.observable(defaultValue);
                    } else {
                        element.slider = false;
                        element.value = ko.observable((element.hasOwnProperty("default")) ? element["default"] : undefined);
                    }
                });
            }

            var js;
            if (control.hasOwnProperty("javascript")) {
                js = control.javascript;

                // if js is a function everything's fine already, but if it's a string we need to eval that first
                if (!_.isFunction(js)) {
                    control.javascript = function (data) {
                        eval(js);
                    };
                }
            }

            if (control.hasOwnProperty("enabled")) {
                js = control.enabled;

                // if js is a function everything's fine already, but if it's a string we need to eval that first
                if (!_.isFunction(js)) {
                    control.enabled = function (data) {
                        return eval(js);
                    }
                }
            }

            control.processed = true;
            return control;
        };

        self.isCustomEnabled = function (data) {
            if (data.hasOwnProperty("enabled")) {
                return data.enabled(data);
            } else {
                return self.isOperational() && self.loginState.isUser();
            }
        };

        self.clickCustom = function (data) {
            var callback;
            if (data.hasOwnProperty("javascript")) {
                callback = data.javascript;
            } else {
                callback = self.sendCustomCommand;
            }

            if (data.confirm) {
                showConfirmationDialog(data.confirm, function (e) {
                    callback(data);
                });
            } else {
                callback(data);
            }
        };

        self.getToolState = function () {
            $.ajax({
                url: API_BASEURL + "printer/tool",
                type: "GET",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                success: function(state) {

                    self.extruder1Temp = state['tool0']['actual'];
                    self.extruder2Temp = state['tool1']['actual'];
                    self.extruder2Pressure = state['tool2']['actual'];


                    $('#extruder1Temp').val(self.extruder1Temp);
                    $('#extruder2Pressure').val(self.extruder2Pressure);
                    $('#extruder2Temp').val(self.extruder2Temp);
                }
            });
            $.ajax({
                url: API_BASEURL + "printer/bed",
                type: "GET",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                success: function(state) {
                    
                    self.extruder1Pressure = state['bed']['actual'];

                    $('#extruder1Pressure').val(self.extruder1Pressure);
                }
            });
            
        }
        
        self.getPrinterState = function () {
            $.ajax({
                url: API_BASEURL + "printer",
                type: "GET",
                datatype: "json",
                contentType: "application/json; charset=UTF-8",
                success: function (resp) {
                    self.position = resp.position;
                }
            })
        }

        if (self.isOperational()) {
            setInterval(self.getToolState, 2000);
            setInterval(self.getPrinterState, 1000);
        }
        


        self.sendJogCommand = function (axis, multiplier, distance) {

            if (typeof distance === "undefined")
                distance = $('#jog_distance button.active').data('distance');
            if (self.settings.printerProfiles.currentProfileData() && self.settings.printerProfiles.currentProfileData()["axes"] && self.settings.printerProfiles.currentProfileData()["axes"][axis] && self.settings.printerProfiles.currentProfileData()["axes"][axis]["inverted"]()) {
                multiplier *= -1;
            }

            var data = {
                "command": "jog"
            };
            data[axis] = distance * multiplier;

            self.sendPrintHeadCommand(data);
        };

        self.sendHomeCommand = function (axis) {
             var tools = self.tools();
            if (axis == 'e') {
                if (self.homed['z'] == false) {
                    self.sendHomeCommand('z');
                } else if (parseFloat(self.position['Z']) < 25.00) {
                     self.sendCustomCommand({
                        type: "commands",
                        commands: [
                            "G1 Z50 F1000"
                        ]
                    });
                }
            }
            if (axis == 'x,y') {
                if (self.homed['z'] == false) {
                    self.sendHomeCommand('z');
                } else if (parseFloat(self.position['Z']) < 25.00) {
                     self.sendCustomCommand({
                        type: "commands",
                        commands: [
                            "G1 Z50 F1000"
                        ]
                    });

                }
                if (self.homed['e'] == false) {
                    self.sendHomeCommand('e');
                } else if (parseFloat(self.position['E']) > self.midpoint) {
                     self.sendCustomCommand({
                        type: "commands",
                        commands: [
                            "G1 E"+ self.midpoint + "F1000"
                        ]
                    });
                }
            }

            self.sendPrintHeadCommand({
                "command": "home",
                "axes": axis
            });
            self.homed[axis] = true;
            if (self.homed['x,y'] == true && self.homed['z'] == true && self.homed['e'] == true) {
                self.isHomed(true);
            }


            if (axis == ['x', 'y']) {
                self.extruder1XPos = -1;
                self.extruder1YPos = -1;
                   
                self.extruder2XPos = -1;
                self.extruder2YPos = -1;    
            }
            
            
            
        };

        self.sendFeedRateCommand = function () {
            self.sendPrintHeadCommand({
                "command": "feedrate",
                "factor": self.feedRate()
            });
        };

        self.startExtrude = function (extruder) {
            if (extruder == "tool0") {
                var pin = 16;
                self.extruder1Extruding(true)
            } else if (extruder == "tool1") {
                self.extruder2Extruding(true)
                var pin = 17;
            }
            self.sendCustomCommand({
                type: "commands",
                commands: [
                    'M400',
                    'M42 P' + pin + ' S255'
                ]
            })
        };

        self.stopExtrude = function (extruder) {
            if (extruder == "tool0") {
                var pin = 16;
                self.extruder1Extruding(false)
            } else if (extruder == "tool1") {
                self.extruder2Extruding(false)
                var pin = 17;
            }
            self.sendCustomCommand({
                type: "commands",
                commands: [
                    'M400',
                    'M42 P' + pin + ' S0'
                ]
            })
        };

        self.toggleExtrude = function (extruder) {
            let pin;
            let val;
            if (extruder == "tool0") {
                pin = 16;
                if (self.extruder1Extruding() === true) {
                    self.extruder1Extruding(false);
                    val = 0;
                } else if (self.extruder1Extruding() === false) {
                    self.extruder1Extruding(true);
                    val = 255;
                }
            } else if (extruder == "tool1") {
                pin = 17;
                if (self.extruder2Extruding() === true) {
                    self.extruder2Extruding(false);
                    val = 0;
                } else if (self.extruder2Extruding() === false) {
                    self.extruder2Extruding(true);
                    val = 255;
                }
            }
            self.sendCustomCommand({
                type: "commands",
                commands: [
                    'M400',
                    'M42 P' + pin + " S" + val
                ]
            });
        }

        self.extrudingText = function (extruder) {
            if (self.checkExtruding(extruder) === true) {
                return "Stop"
            } else if (self.checkExtruding(extruder) === false) {
                return "Extrude"
            }
        }

        self.checkExtruding = function (extruder) {
            if (extruder == "tool0") {
                return self.extruder1Extruding();
            } else if (extruder == "tool1") {
                return self.extruder2Extruding();
            }
        }

        self.sendPressureIncrease = function(extruder) {
            if (extruder == "tool0") {
                var regulator = 'L';
            } else if (extruder == "tool1") {
                var regulator = 'R';
            }

            self.sendCustomCommand({
                type: "commands",
                commands: [
                "G91",
                "G1 "+ regulator + "-0.25 ",
                "G90",
                "M18 " + regulator,
                'M105'
                ]
            })
        }




//  Still TODO: Remove duplicate code -> Make a single function to handle both extruders instead of if statement

        self.setTargetPressure = function(item) {     

            if (!item.key() || !item.targetPressure()) return;

            if (item.key() == "tool0") {
                var regulator = 'L';
                $.ajax({
                    url: API_BASEURL + "printer/bed",
                    type: "GET",
                    dataType: "json",
                    contentType: "application/json; charset=UTF-8",
                    success: function(state) {
                        const current = parseFloat(state["bed"]["actual"]);
                        const offset =  (-1 *(item.targetPressure() - current));
          
                        if (Math.abs(offset) > 0.2) {
                            self.sendCustomCommand({
                                type: "commands",
                                commands: [
                                "G91",
                                "G1 "+ regulator + (0.3 * offset) ,
                                "G90",
                                "M18 " + regulator,
                                'M105'
                                ]
                            });
                            
                            setTimeout(function() {
                                self.setTargetPressure(item);
                            }, 500);
                        }
                     
                    }
                });
            } else if (item.key() == "tool1") {
                var regulator = 'R';

                $.ajax({
                    url: API_BASEURL + "printer/tool",
                    type: "GET",
                    dataType: "json",
                    contentType: "application/json; charset=UTF-8",
                    success: function(state) {
                        const current = parseFloat(state["tool2"]["actual"]);
                        const offset =   (-1 *(item.targetPressure() - current));

                        if (Math.abs(offset) > 0.5) {
                             self.sendCustomCommand({
                                    type: "commands",
                                    commands: [
                                    "G91",
                                    "G1 "+ regulator + (0.3 * offset) ,
                                    "G90",
                                    "M18 " + regulator,
                                    'M105'
                                    ]
                                });
                            
                            setTimeout(function() {
                                self.setTargetPressure(item);
                            }, 500);
                        }
                    }
                });
            }       
        }


        self.sendPressureDecrease = function(extruder) {
            if (extruder == "tool0") {
                var regulator = 'L';
            } else if (extruder == "tool1") {
                var regulator = 'R';
            }

            self.sendCustomCommand({
                type: "commands",
                commands: [
                "G91",
                "G1 "+ regulator + "0.25 ",
                "G90",
                "M18 " + regulator,
                'M105'
                ]
            })
        }

        self.sendTempIncrease = function (extruder) {
            var current = self.getToolState();

            if (extruder == 1) {
                var target = current["tool0"]["target"] + 1
                self.sendToolCommand({
                    "command": "target",
                    "targets": { 
                        tool: "tool" + String(extruder),
                        value: target
                    }
                });
            }
        };

        self.selectWellPlate = function (select) {
            self.wellPlate(parseInt($('#wellPlate').val()));
            
            $.ajax({
                url: API_BASEURL + "settings",
                type: "GET",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                success: function (response) {

                    positions = response["positions"][self.wellPlate()];

                    self.sendPrintHeadCommand({
                        "command": "wellplate",
                        "wellplate": self.wellPlate()
                    });
                    self.sendCustomCommand({
                        type: 'commands',
                        commands: [
                            'G90',
                            'G1 Z50 E'+ self.midpoint +' F1000',
                            'G1 X' + positions["tool0"]["X"] + ' Y' + positions["tool0"]["Y"] + ' F2000',
                            'G1 E' + self.extruder1EPos + ' F1000']
                    });

                    self.wellplateSelected(true);
                }
            })            
        }

        self.setExtruderPosition = function (item) {
            var eTarget = -1;
            const tool = item.key()
            if (tool == 'tool0') {
                eTarget = self.extruder1EPos;
            } else if (tool == 'tool1') {
                eTarget = self.extruder2EPos;
            }
            self.sendCustomCommand({
                type: 'commands',
                commands: [
                    'G90',
                    'G1 Z50 E' + self.midpoint + ' F1000',
                    'G1 X' + item.xPosition() + ' Y' + item.yPosition() + ' F2000',
                    'G1 E' + eTarget + ' F1000',
                    'G1 Z' + item.zPosition() + ' F1000'
                ]
            });
        }

        self.loadExtruderPosition = function (item) {
            const tool = parseInt(item.key()[4])

            self.tools()[tool].xPosition(self.xActualPosition());
            self.tools()[tool].yPosition(self.yActualPosition());
            self.tools()[tool].zPosition(self.zActualPosition());
        }

        self.saveExtruderPosition = function (item) {           
            const tool = item.key()
            if (tool == 'tool0') {
                self.extruder1XPos = item.xPosition();
                self.extruder1YPos = item.yPosition();
                self.extruder1ZPos = item.zPosition();
            } else if (tool == 'tool1') {
                self.extruder2XPos = item.xPosition();
                self.extruder2YPos = item.yPosition();
                self.extruder2ZPos = item.zPosition();
            }

            if (tool == 'tool0') {
                self.switchTool('tool1');
            } else if (tool == 'tool1') {
                self.switchTool('tool0');
            }
            self.sendPrintHeadCommand({
                "command": "position",
                "wellplate": self.wellPlate(),
                "positions": {
                    "tool0" : {
                        "X": self.extruder1XPos,
                        "Y": self.extruder1YPos,
                        "Z": self.extruder1ZPos
                    },
                    "tool1" : {
                        "X": self.extruder2XPos,
                        "Y": self.extruder2YPos,
                        "Z": self.extruder2ZPos
                    }
                }
            });
        }

        self.saveToolChangeDist = function (tool) {
            if (tool == 'tool0') {
                self.extruder1XPos = self.position["X"]
                self.extruder1YPos = self.position["Y"]
                self.extruder1ZPos = self.position["Z"]
            } else if (tool == 'tool1') {
                self.extruder2XPos = self.position["X"]
                self.extruder2YPos = self.position["Y"]
                self.extruder2ZPos = self.position["Z"]
            }

            if (tool == 'tool0') {
                self.switchTool('tool1');
            } else if (tool == 'tool1') {
                self.switchTool('tool0');
            }
            self.sendPrintHeadCommand({
                "command": "position",
                "wellplate": self.wellPlate(),
                "positions": {
                    "tool0" : {
                        "X": self.extruder1XPos,
                        "Y": self.extruder1YPos,
                        "Z": self.extruder1ZPos
                    },
                    "tool1" : {
                        "X": self.extruder2XPos,
                        "Y": self.extruder2YPos,
                        "Z": self.extruder2ZPos
                    }
                }
            });
        }

        self.switchTool = function(tool) {
            var target;
            var dir;
            if (tool == 'tool0') {
                if (self.extruder1EPos != -1) {
                    target = self.extruder1EPos;    
                } else {
                    target = self.midpoint;
                }
                dir = -1;
                self.extruder2Selected(false);
                self.extruder1Selected(true);
            } else if (tool == 'tool1') {
                if (self.extruder2EPos != -1) {
                    target = self.extruder2EPos;    
                } else {
                    target = self.midpoint;
                }
                dir = 1;
                self.extruder1Selected(false);
                self.extruder2Selected(true);
            }
            self.sendCustomCommand({
                type: 'commands',
                commands: [
                    'G90',
                    'G1 Z50 F1000',
                    'T0',
                    'M400',
                    'G1 E' + self.midpoint + ' F1000.00',
                    'M400',
                    'G91',
                    'G1 X' + dir * self.xTravel + ' F2000.00',
                    'G90',
                    'M400',
                    'G1 E' + target + ' F1000.00',
                    'M400'
                ]
            });
        }

        self.extruderSelected = function(tool) {
            if (tool == "tool0") {
                return self.extruder1Selected();
            } else if (tool == "tool1") {
                return self.extruder2Selected();
            }
        }

        self.toolMid = function() {
            self.sendCustomCommand({
                type: 'commands',
                commands: [
                    'T0',
                    'M400',
                    'G1 E' + self.midpoint + ' F1000.00'
                ]
            });
        }

        self.sendTempDecrease = function (extruder) {
            var target = 0;
            if(extruder == 1) {
                target = self.extruder1Temp - 1
            } else if (extruder == 2) {
                target = self.extruder2Temp - 1
            }

            self.sendToolCommand({
                "command": "target",
                "targets": { 
                    tool: "tool" + String(extruder),
                    value: target
                }
            });
        }

        self.sendLightIntensity = function () {
            if (self.lightOn()) {
                self.sendToolCommand({
                    "command": "light",
                    "intensity": 0
                });
                self.lightOn(false)
            } else {

                self.sendToolCommand({
                    "command": "light",
                    "intensity": (parseFloat(self.lightIntensity()) / 100) * 12.75,
                });
                self.lightOn(true)
            }
            
        }

        self.lightIntensityText = function() {
            if (self.lightOn()) {
                return "Disable";
            } else {
                return "Enable";
            }
        }

        self.sendFlowRateCommand = function () {
            self.sendToolCommand({
                "command": "flowrate",
                "factor": self.flowRate()
            });
        };

        self._sendECommand = function (dir) {
            var length = self.extrusionAmount();
            if (!length) length = self.settings.printer_defaultExtrusionLength();

            self.sendToolCommand({
                command: "extrude",
                amount: length * dir
            });
        };

        self.sendSelectToolCommand = function (data) {
            if (!data || !data.key()) return;

            self.sendToolCommand({
                command: "select",
                tool: data.key()
            });
        };

        self.sendPrintHeadCommand = function (data) {
            $.ajax({
                url: API_BASEURL + "printer/printhead",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify(data)
            });
        };

        self.sendToolCommand = function (data) {
            $.ajax({
                url: API_BASEURL + "printer/tool",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify(data)
            });
        };

        self.sendCustomCommand = function (command) {
            if (!command)
                return;

            var data = undefined;
            if (command.hasOwnProperty("command")) {
                // single command
                data = {"command": command.command};
            } else if (command.hasOwnProperty("commands")) {
                // multi command
                data = {"commands": command.commands};
            } else if (command.hasOwnProperty("script")) {
                data = {"script": command.script};
                if (command.hasOwnProperty("context")) {
                    data["context"] = command.context;
                }
            } else {
                return;
            }

            if (command.hasOwnProperty("input")) {
                // parametric command(s)
                data["parameters"] = {};
                _.each(command.input, function(input) {
                    if (!input.hasOwnProperty("parameter") || !input.hasOwnProperty("value")) {
                        return;
                    }

                    data["parameters"][input.parameter] = input.value();
                });
            }

            $.ajax({
                url: API_BASEURL + "printer/command",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify(data)
            })
        };

        self.loadTemplates = function() {
            $.ajax({
                url: API_BASEURL + 'users/templates',
                type: 'GET',
                success: function(res) {
                    console.log(res);
                }
            });

        }

        self.sendEmergencyStop = function () {

            self.sendCustomCommand({
                type: 'command',
                command: 'M112'
            });
        }

        self.displayMode = function (customControl) {
            if (customControl.hasOwnProperty("children")) {
                if (customControl.name) {
                    return "customControls_containerTemplate_collapsable";
                } else {
                    return "customControls_containerTemplate_nameless";
                }
            } else {
                return "customControls_controlTemplate";
            }
        };

        self.rowCss = function (customControl) {
            var span = "span2";
            var offset = "";
            if (customControl.hasOwnProperty("width")) {
                span = "span" + customControl.width;
            }
            if (customControl.hasOwnProperty("offset")) {
                offset = "offset" + customControl.offset;
            }
            return span + " " + offset;
        };

        self.onStartup = function () {
            self.requestData();
            self.entryDialog = $('#entry_dialog')
        };

        self.updateRotatorWidth = function() {
            var webcamImage = $("#webcam_image");
            if (self.settings.webcam_rotate90()) {
                if (webcamImage.width() > 0) {
                    $("#webcam_rotator").css("height", webcamImage.width());
                } else {
                    webcamImage.off("load.rotator");
                    webcamImage.on("load.rotator", function() {
                        $("#webcam_rotator").css("height", webcamImage.width());
                        webcamImage.off("load.rotator");
                    });
                }
            } else {
                $("#webcam_rotator").css("height", "");
            }
        }

        self.onSettingsBeforeSave = self.updateRotatorWidth;

        self.onTabChange = function (current, previous) {
            if (current == "#control") {
                if (self.webcamDisableTimeout != undefined) {
                    clearTimeout(self.webcamDisableTimeout);
                }
                var webcamImage = $("#webcam_image");
                var currentSrc = webcamImage.attr("src");
                if (currentSrc === undefined || currentSrc.trim() == "") {
                    var newSrc = CONFIG_WEBCAM_STREAM;
                    if (CONFIG_WEBCAM_STREAM.lastIndexOf("?") > -1) {
                        newSrc += "&";
                    } else {
                        newSrc += "?";
                    }
                    newSrc += new Date().getTime();

                    self.updateRotatorWidth();
                    webcamImage.attr("src", newSrc);
                }
            } else if (previous == "#control") {
                // only disable webcam stream if tab is out of focus for more than 5s, otherwise we might cause
                // more load by the constant connection creation than by the actual webcam stream
                self.webcamDisableTimeout = setTimeout(function () {
                    $("#webcam_image").attr("src", "");
                }, 5000);
            }
        };

        self.onAllBound = function (allViewModels) {
            var additionalControls = [];
            _.each(allViewModels, function (viewModel) {
                if (viewModel.hasOwnProperty("getAdditionalControls")) {
                    additionalControls = additionalControls.concat(viewModel.getAdditionalControls());
                }
            });
            if (additionalControls.length > 0) {
                self.additionalControls = additionalControls;
                self.rerenderControls();
            }
        };

        self.onFocus = function (data, event) {
            if (!self.settings.feature_keyboardControl()) return;
            self.keycontrolActive(true);
        };

        self.onMouseOver = function (data, event) {
            if (!self.settings.feature_keyboardControl()) return;
            $("#webcam_container").focus();
            self.keycontrolActive(true);
        };

        self.onMouseOut = function (data, event) {
            if (!self.settings.feature_keyboardControl()) return;
            $("#webcam_container").blur();
            self.keycontrolActive(false);
        };

        self.toggleKeycontrolHelp = function () {
            self.keycontrolHelpActive(!self.keycontrolHelpActive());
        };

        self.onKeyDown = function (data, event) {
            if (!self.settings.feature_keyboardControl()) return;

            var button = undefined;
            var visualizeClick = true;

            switch (event.which) {
                case 37: // left arrow key
                    // X-
                    button = $("#control-xdec");
                    break;
                case 38: // up arrow key
                    // Y+
                    button = $("#control-yinc");
                    break;
                case 39: // right arrow key
                    // X+
                    button = $("#control-xinc");
                    break;
                case 40: // down arrow key
                    // Y-
                    button = $("#control-ydec");
                    break;
                case 49: // number 1
                case 97: // numpad 1
                    // Distance 0.1
                    button = $("#control-distance01");
                    visualizeClick = false;
                    break;
                case 50: // number 2
                case 98: // numpad 2
                    // Distance 1
                    button = $("#control-distance1");
                    visualizeClick = false;
                    break;
                case 51: // number 3
                case 99: // numpad 3
                    // Distance 10
                    button = $("#control-distance10");
                    visualizeClick = false;
                    break;
                case 52: // number 4
                case 100: // numpad 4
                    // Distance 100
                    button = $("#control-distance100");
                    visualizeClick = false;
                    break;
                case 33: // page up key
                case 87: // w key
                    // z lift up
                    button = $("#control-zinc");
                    break;
                case 34: // page down key
                case 83: // s key
                    // z lift down
                    button = $("#control-zdec");
                    break;
                case 36: // home key
                    // xy home
                    button = $("#control-xyhome");
                    break;
                case 35: // end key
                    // z home
                    button = $("#control-zhome");
                    break;
                default:
                    event.preventDefault();
                    return false;
            }

            if (button === undefined) {
                return false;
            } else {
                event.preventDefault();
                if (visualizeClick) {
                    button.addClass("active");
                    setTimeout(function () {
                        button.removeClass("active");
                    }, 150);
                }
                button.click();
            }
        };

        self.showEntryDialog = function(key) {
            self.entryDialog.modal({
                minHeight: function() { return Math.max($.fn.modal.defaults.maxHeight() - 80, 250); }
            }).css({
                width: 'auto',
                'margin-left': function() { return -($(this).width() / 2); }
            });

            return false;
        }

        
    
        self.loadExtruderValues = function(tool) {
            const index = parseInt(tool[4]); 
            const entryId = $('#' + tool + 'EntrySelector').val();
            const tools = self.tools();
            self.wellPlate(1);
            tools[index].xPosition(self.extruderEntries[entryId]["content"]["positions"][self.wellPlate()][tool]['X']);
            tools[index].yPosition(self.extruderEntries[entryId]["content"]["positions"][self.wellPlate()][tool]['Y']);
            tools[index].zPosition(self.extruderEntries[entryId]["content"]["positions"][self.wellPlate()][tool]['Z']);
            tools[index].ePosition(self.extruderEntries[entryId]["content"]["positions"][self.wellPlate()][tool]['E']);
        }

        self.newExtruderEntry = function() {
            var entry = {};
            entry["name"] = self.modalName();
            entry["content"] = {};
        
            entry["content"]["X"] = self.modalXPosition();
            entry["content"]["Y"] = self.modalYPosition();
            entry["content"]["Z"] = self.modalZPosition();
            entry["content"]["temperature"] = self.modalXPosition();
            entry["content"]["pressure"] = self.modalPressure();
            entry["content"]["wellplate"] = self.wellPlate();
            entry["content"]["type"] = self.modalType();

            //send to flask app here
             $.ajax({
                url: API_BASEURL + "user/entries/new",
                type: "POST",
                data: JSON.stringify(entry),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    if (response['status']) {
                            self.loadTemplates();
                    }
                }
            });
        }


        self.saveExtruderValues = function() {
            const tool = self.modalTool();
            const tools = self.tools();
            const index = parseInt(tool[4]); 
            const entryId = $('#' + tool + 'EntrySelector').val();

        
            if  (parseInt(tools[index].xPosition()) !== parseInt(self.extruderEntries[entryId]["content"]["xPosition"]) ||
                (parseInt(tools[index].yPosition()) !== parseInt(self.extruderEntries[entryId]["content"]["yPosition"])) ||
                (parseInt(tools[index].zPosition()) !== parseInt(self.extruderEntries[entryId]["content"]["zPosition"]))) {

                var tempContent = self.extruderEntries[entryId]["content"];

                //  Show error message
                if ((tool == 'tool0') && (parseFloat(tools[index].pressure()) > 100)) {
                    return;
                }

                tempContent["positions"][self.wellPlate()][tool]['X'] = parseFloat(self.modalXPosition());
                tempContent["positions"][self.wellPlate()][tool]['Y'] = parseFloat(self.modalYPosition());
                tempContent["positions"][self.wellPlate()][tool]['Z'] = parseFloat(self.modalZPosition());
                tempContent["pressure"] = parseFloat(self.modalPressure());
                tempContent["temperature"] = parseFloat(self.modalTemperature());
                tempContent["type"] = self.modalType();

                data = {
                    id: entryId, 
                    content: tempContent
                };

                $.ajax({
                    url: API_BASEURL + "user/entry/update", 
                    type: "POST",
                    data: JSON.stringify(data),
                    contentType: "application/json",
                    success: function(response) {
                        if (response['status']) {
                            self.loadTemplates();
                        }
                    }
                });
            } 

        }

        self.modalTool = ko.observable('');
        self.modalEntryId = null;
        self.modalXPosition = ko.observable(0);
        self.modalYPosition = ko.observable(0);
        self.modalZPosition = ko.observable(0);
        self.modalTemperature = ko.observable(0);
        self.modalPressure = ko.observable(0);
        self.modalName = ko.observable('');
        self.modalType = ko.observableArray(["extruder1", "extruder2"]);

        self.setupModalForSave = function(tool) {
            const index = parseInt(tool[4]); 
            const tools = self.tools();
            const entryId = $('#' + tool + 'EntrySelector').val();

            self.modalTool(tool);
            self.modalEntryId = entryId;
            self.modalName(self.extruderEntries[entryId]["name"]);
            self.modalXPosition(tools[index].xPosition());
            self.modalYPosition(tools[index].yPosition());
            self.modalZPosition(tools[index].zPosition());
            self.modalTemperature(tools[index].temperature());
            self.modalPressure(tools[index].pressure());
        }

        self.calibrateExtruderPosition = function (item) {
            self.saveExtruderPosition(item).then((response) => {
                self.setExtruderPosition(item); 
            })
            
        }
        self.loadTemplates = function () {
           $.ajax({
                url: API_BASEURL + "user/entries/extruder",
                type: "GET",
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    if (response["status"]) {
                        const tools = self.tools();
                        for (var i=0; i < response["result"]["entries"].length; i++) {

                            //name ==> id
                            self.extruderEntries[response["result"]["entries"][i]["entry"]["_id"]] = response["result"]["entries"][i]["entry"]; 
                           
                            const validExtruders = response["result"]["entries"][i]["entry"]["content"]["type"];

                            
                            for (var extruder of validExtruders){
                                const index = parseInt(extruder[8]) - 1; 
                                const currentEntry = {};
                                currentEntry["name"] = response["result"]["entries"][i]["entry"]["name"];
                                currentEntry["id"] = response["result"]["entries"][i]["entry"]["_id"];

                                tools[index].entryNames.push(currentEntry);
                            }

                        }
                    }
                }
            });
        };


        self.onUserLoggedIn = function (user) {
            self.loadTemplates();
        }


    }



    bioprint_VIEWMODELS.push([
        ControlViewModel,
        ["loginStateViewModel", "settingsViewModel"],
        "#control"
    ]);
});

