'use strict';

var inherits = require('util').inherits;
var Service, Characteristic, BatteryCharacteristic;
var mqtt = require("mqtt");

function mqtthomegearContactSensorAccessory(log, config) {
    this.log = log;
    this.name = config["name"];
    this.url = config["url"];
    this.client_Id = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
    this.options = {
        keepalive: 10,
        clientId: this.client_Id,
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        will: {
            topic: 'WillMsg',
            payload: 'Connection Closed abnormally..!',
            qos: 0,
            retain: false
        },
        username: config["username"],
        password: config["password"],
        rejectUnauthorized: false
    };

    this.caption = config["caption"];
    this.topics = config["topics"];
    this.contactState = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
    this.Battery = 0;


    this.options_publish = {
        qos: 0,
        retain: true
    };

    this.service = new Service.ContactSensor(this.name);
    this.service.addCharacteristic(BatteryCharacteristic);
    this.service.getCharacteristic(BatteryCharacteristic)
        .on('get', this.getBattery.bind(this));


    // connect to MQTT broker
    this.client = mqtt.connect(this.url, this.options);

    this.client.on('error', (err) => {
        this.log('Error event on MQTT:', err);
    });

    this.client.on('message', (topic, message) => {
        switch (topic) {
            case `${this.topics.get}1/STATE`:
                this.contactState = (message.toString() === "true") ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;
                this.log('STATE CHANGE: ' + this.contactState);
                this.service.getCharacteristic(Characteristic.ContactSensorState).setValue(this.contactState);
                break;

            case `${this.topics.get}1/LOWBAT`:
                this.Battery = (message.toString() === "true") ? BatteryCharacteristic.EMPTY : BatteryCharacteristic.FULL;
                this.log('STATE CHANGE: Battery empty: ' + this.Battery);
                this.service.getCharacteristic(BatteryCharacteristic).setValue(this.Battery, undefined, 'fromSetValue');
                break;
        }
    });

    this.client.subscribe(this.topics.get + '#');
}

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    makeBatteryCharacteristic();
    homebridge.registerAccessory("homebridge-mqtt-homegear-contactsensor", "mqtt-homegear-contactsensor", mqtthomegearContactSensorAccessory);
}



mqtthomegearContactSensorAccessory.prototype.getState = function(callback) {
    this.log(`getState - Asking for contact state ${this.contactState}`);
    callback(null, this.contactState);
};

mqtthomegearContactSensorAccessory.prototype.getBattery = function(callback) {
    this.log(`getBattery - Asking for battery state ${this.Battery}`);
    callback(null, this.Battery);
}

mqtthomegearContactSensorAccessory.prototype.getServices = function() {
    return [this.service];
}


function makeBatteryCharacteristic() {
    BatteryCharacteristic = function() {
        Characteristic.call(this, 'Battery empty', '91288367-5678-49B2-8D22-F57BE995AA00');
        this.setProps({
            format: Characteristic.Formats.BOOL,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(BatteryCharacteristic, Characteristic);
    BatteryCharacteristic.EMPTY = 1;
    BatteryCharacteristic.FULL = 0;
}