# What is relayEquipment Manager?
 relayEquipmentManager was written to take advantage of source triggers to trigger relays via GPIO (General Purpose Input/Output) on Raspberry Pi and BeagleBone boards.  The primary development has been around nodejs-PoolController to extend virtual equipment that is attached to the poolController server.  The interface makes it very easy to configure equipment extensions not supported by traditional pool equipment.
 
 While triggers have been developed for sources such as webSockets, additional triggers are in development to include an internal MQTT broker, User defined HTTP webhooks for responding to closed APIs and an MQTT client for subscribing and publishing pin states.
 
 ## Installation
 To install relayEquipmentManager clone the repository to either a Raspberry Pi or BeagleBone.  While you can install this software on other platforms to try it out the GPIO functions will not do anything.  All that will happen is the node console will show feedback to simulate GPIO operations.

After you have cloned the repository run ```npm install``` or ```sudo npm install``` in the cloned directory depending on the permissions assigned to the user on your linux console.  Once completed run ```npm start``` or ```sudo npm start``` to start the relayEquipmentManager server.

## System Configuration
relayEquipmentManager server includes a web server for configuration of connection sources, triggers, and emitted data.  The default port for this server is :8080 on with the address being the IP address for the Raspberry Pi or BeagleBone.  To access this web application, open a browser, and type ```http://<ip address>:8080``` for default Raspberry Pi installations you can use the name of the Pi for the ip address.
```
{
  "web": {
    "servers": {
      "http": {
        "enabled": true,
        "ip": "0.0.0.0",
        "port": 8080,
        "httpsRedirect": false,
        "authentication": "none",
        "authFile": "/users.htpasswd"
      },
      "https": {
        "enabled": true,
        "ip": "127.0.0.1",
        "port": 8081,
        "authentication": "none",
        "authFile": "/users.htpasswd",
        "sslKeyFile": "",
        "sslCertFile": ""
      },
      "mdns": { "enabled": false },
      "sspd": { "enabled": false },
      "services": {}
    }
  },
  "log": {
    "app": {
      "enabled": true,
      "level": "info"
    }
  },
  "appVersion": "1.0.0"
}
```

The configuration parameters for the server can be found the ```config.json``` file located in the application root directory.

## Software Configuration
Currently, the software only supports GPIO outputs for things such as relays and leds.  For more information on configuring relayEquipmentManager refer to the wiki.

