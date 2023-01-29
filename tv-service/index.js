const pkgInfo = require('./package.json');
const Service = require('webos-service');
const mqtt = require('mqtt');
const { log, getLogs, clearLogs } = require("./log");

// This should be unique across the MQTT network. If you're using this on multiple TVs, update this
const deviceID = 'webOSTVService'

const service = new Service(pkgInfo.name); // Create service by service name on package.json
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;

// MQTT auto-discovery configuration
const topicAutoDiscoveryPlayState = `homeassistant/sensor/${deviceID}/playState/config`;
const topicAutoDiscoveryAppId = `homeassistant/sensor/${deviceID}/appId/config`;
const topicAutoDiscoveryType = `homeassistant/sensor/${deviceID}/type/config`;

const topicAvailability = `LG2MQTT/${deviceID}/availability`;
const topicState = `LG2MQTT/${deviceID}/state`;

function createAutoDiscoveryConfig(icon, id, name) {
    return {
        "icon": `${icon}`,
        "~": `LG2MQTT/${deviceID}/`,
        "availability_topic": `${topicAvailability}`,
        "state_topic": `${topicState}`,
        "name": `${name}`,
        "unique_id": `${deviceID}_${id}`,
        "payload_available": "online",
        "payload_not_available": "offline",
        "value_template": `{{ value_json.${id}}}`,
        "device": {
            "identifiers": `${deviceID}`,
            "name": `${deviceID}`,
            "manufacturer": "LG",
        }
    };
}

function createState(play, app, type) {
    return {
        'play': `${play}`,
        'app': `${app}`,
        'type': `${type}`
    };
}

function publishAutoDiscoveryConfigs() {
    let pubOptions = { qos: 0, retain: true };
    client.publish(topicAutoDiscoveryPlayState, JSON.stringify(createAutoDiscoveryConfig("mdi:play-pause", "play", "Play State")), pubOptions, function (err) {
        if (err) {
            log(`An error occurred during publish to ${topicAutoDiscoveryPlayState}`);
        } else {
            log(`Published successfully to ${topicAutoDiscoveryPlayState}`);
        }
    });

    client.publish(topicAutoDiscoveryAppId, JSON.stringify(createAutoDiscoveryConfig("mdi:apps", "app", "Application ID")), pubOptions, function (err) {
        if (err) {
            log(`An error occurred during publish to ${topicAutoDiscoveryAppId}`);
        } else {
            log(`Published successfully to ${topicAutoDiscoveryAppId}`);
        }
    });

    client.publish(topicAutoDiscoveryType, JSON.stringify(createAutoDiscoveryConfig("mdi:import", "type", "Discovery Type")), pubOptions, function (err) {
        if (err) {
            log(`An error occurred during publish to ${topicAutoDiscoveryType}`);
        } else {
            log(`Published successfully to ${topicAutoDiscoveryType}`);
        }
    });
}

function publishState(play, app, type) {
    let pubOptions = { qos: 0, retain: false };
    client.publish(topicState, JSON.stringify(createState(play, app, type)), pubOptions, function (err) {
        if (err) {
            log(`An error occurred during publish to ${topicState}`);
        } else {
            log(`Published successfully to ${topicState}`);
        }
    });
}

function publishOnline() {
    let pubOptions = { qos: 0, retain: true };
    client.publish(topicAvailability, "online", pubOptions, function (err) {
        if (err) {
            log(`An error occurred during publish to ${topicAvailability}`);
        } else {
            log(`Published successfully to ${topicAvailability}`);
        }
    });
}

function publishOffline() {
    let pubOptions = { qos: 0, retain: true };
    client.publish(topicAvailability, "offline", pubOptions, function (err) {
        if (err) {
            log(`An error occurred during publish to ${topicAvailability}`);
        } else {
            log(`Published successfully to ${topicAvailability}`);
        }
    });
} 

let keepAlive;
let client;
let state = 'NOT STARTED';

let host;
let port;
let username;
let password;

service.register('start', function (message) {
    try {
        log('Starting service MQTT service...');

        // This tells the ActivityManager to keep the service running in the background, so the MQTT connection will be kept alive.
        service.activityManager.create('keepAlive', function (activity) {
            log('keepAlive created');
            keepAlive = activity;
        });
        log('Registered keepAlive.');

        try {
            log("Retrieving MQTT configuration...");

            // Try get the MQTT configuration from the database
            service.call('luna://com.palm.db/find', {
                "query": {
                    "from": 'com.yorkshireiot.lg2mqtt:1'
                },
            }, function (message) {
                // This will be done asynchronously with everything outside this function.
                // At the very worst and error will be thrown inside the subscribe if
                // this app is close and another starts publishing info before MQTT has connected.
                // But as long as MQTT does successfully connect eventually everything should work fine.
                if (message.payload.returnValue) {
                    log("Got MQTT configuration: " + JSON.stringify(message.payload.results));

                    // Save the values into the global variables
                    username = message.payload.results[0].username;
                    password = message.payload.results[0].password;
                    host = message.payload.results[0].host;
                    port = message.payload.results[0].port;

                    // At this point the MQTT config should be defined and ready to connect with
                    connectUrl = `mqtt://${host}:${port}`;
                    const mqttConfig = {
                        clientId,
                        clean: true,
                        keepalive: 60, // 3 minutes
                        username,
                        password,
                        will: {
                            topic: topicAvailability,
                            payload: "offline",
                            retain: true,
                            qos: 0
                        }
                    };

                    log(`Connecting to MQTT server ${connectUrl} with configuration:\n ${JSON.stringify(mqttConfig)}`);
                    client = mqtt.connect(connectUrl, mqttConfig);

                    client.on('connect', function () {
                        log("MQTT connected");
                        state = 'MQTT CONNECTED'
                    });

                    client.on('error', function (error) {
                        log("MQTT error");
                        log(error);
                        state = 'MQTT ERROR'
                    });

                    state = 'MQTT CONNECTING';

                    log("Sending Home Assistant auto-discovery configs..");
                    try {
                        publishAutoDiscoveryConfigs();
                    }
                    catch (e) {
                        throw new Error("Failed to publish auto-discovery configs.\n" + JSON.stringify(e));
                    }

                    // Publish initial state
                    try {
                        publishState('idle', 'unknown', 'unknown');
                    }
                    catch (e) {
                        throw new Error("Failed to publish initial state.\n" + JSON.stringify(e));
                    }

                    // Set availability to online
                    try {
                        publishOnline();
                    }
                    catch (e) {
                        throw new Error("Failed to publish 'online' to availability topic.\n" + JSON.stringify(e));
                    }
                }
                else {
                    throw new Error("Service call successful but db find returned error code" + JSON.stringify(message.payload));
                }
            });
        }
        catch (e) {
            log("Failed to setup MQTT");
            log(e);
            message.respond({
                started: false,
                logs: getLogs(),
            });
            state = 'FAILED TO SETUP MQTT';
            return;
        }

        log('Subscribing to media service');
        // Subscribe to the com.webos.media service, to receive updates from the tv
        service.subscribe('luna://com.webos.media/getForegroundAppInfo', { 'subscribe': true })
            .on('response', function (message) {
                if (message.payload && message.payload.foregroundAppInfo) {
                    if (Array.isArray(message.payload.foregroundAppInfo) && message.payload.foregroundAppInfo.length > 0) {
                        log(`Sending ForegroundAppInfo update to MQTT: ${JSON.stringify(message.payload)}`);
                        publishState(`${message.payload.foregroundAppInfo[0].playState}`,
                            `${message.payload.foregroundAppInfo[0].appId}`,
                            `${message.payload.foregroundAppInfo[0].type}`);
                    } else {
                        log(`Ignored ForegroundAppInfo because it's no array, or empty: ${JSON.stringify(message.payload)}`);
                        publishState('idle', 'unknown', 'unknown');
                    }
                } else {
                    log(`Ignored ForegroundAppInfo because it contains no info: ${JSON.stringify(message)}`);
                    publishState('idle', 'unknown', 'unknown');
                }
                try {
                    publishOnline();
                }
                catch (e) {
                    log("Failed to set availability to online");
                    log(e);
                    message.respond({
                        started: false,
                        logs: getLogs(),
                    });
                    state = 'FAILED TO SET ONLINE';
                    return;
                }
            });


        log('Started service');
        message.respond({
            started: true,
            logs: getLogs(),
        });
        state = 'STARTED';
    } catch (err) {
        log(`Failed starting: ${JSON.stringify(err)}`);
        message.respond({
            started: false,
            logs: getLogs(),
        });
        state = 'FAILED TO START';
    }
});

service.register('stop', function (message) {
    try {
        log('Stopping service');

        log('Closing mqtt connection');
        try {
            // Broker doesn't seem to be sending offline message at client disconnect. Send manually
            publishOffline();
            client.end();
        }
        catch (e) {
            log("Failed to close MQTT connection");
            log(e);
        }

        log('Ending keepAlive...');
        try {
            service.activityManager.complete(keepAlive);
            log('completed keepAlive');
        } catch (e) {
            log("Failed to end keep alive");
            log(e);
        }

        message.respond({
            stopped: true,
            logs: getLogs()
        });
        state = 'STOPPED';
    } catch (err) {
        log("Failed to stop service!");
        log(err);
        message.respond({
            started: false,
            logs: getLogs(),
        });
        state = 'FAILED TO STOP';
    }
});

service.register('logs', function (message) {
    message.respond({
        logs: getLogs(),
    });
});

service.register('clearLogs', function (message) {
    clearLogs();

    message.respond({
        cleared: true,
        logs: getLogs()
    });
});

service.register('getState', function (message) {
    message.respond({
        state,
        logs: getLogs()
    });
});
