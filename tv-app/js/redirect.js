console.log("Seeing if MQTT configuration exists...");
webOS.service.request('luna://com.palm.db', {
    method: 'find',
    parameters: {
        query: {
            from: 'com.yorkshireiot.lg2mqtt:1'
        },
    },
    onSuccess: function (inResponse) {
        console.log("Found MQTT configuration:")
        console.log(inResponse);
        return;
    },
    onFailure: function (inError) {
        console.log('Failed to find the config object with query');
        console.log('[' + inError.errorCode + ']: ' + inError.errorText);
        console.log('Creating database first...');
        var request = webOS.service.request('luna://com.palm.db', {
            method: 'putKind',
            parameters: {
                id: 'com.yorkshireiot.lg2mqtt:1',
                owner: 'com.yorkshireiot.lg2mqtt',
                private: true,
                indexes: [
                    {
                        name: 'mqtt_config',
                        props: [{ name: 'host' }, { name: 'port' }, { name: 'username' }, { name: 'password' }],
                    }
                ],
            },
            onSuccess: function (inResponse) {
                console.log('The kind is created');
                // To-Do something
            },
            onFailure: function (inError) {
                console.log('Failed to create the kind');
                console.log('[' + inError.errorCode + ']: ' + inError.errorText);
                // To-Do something
                return;
            },
        });

        window.location.replace("setConfig.html");
        return;
    },
});