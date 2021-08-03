# What is relayEquipmentManager?
 
 relayEquipmentManager (REM) is designed as a software management console for hardware interfaces.  It provides an easy to configure and manage user interface that links hardware devices to software solutions such as nodejs-PoolController, MQTT interfaces, and web sockets. Initially, REM was written to take advantage of source triggers to trigger relays via GPIO (General Purpose Input/Output) on Raspberry Pi and BeagleBone boards, but since its inception, it has been expanded to support several common I2c and SPI interface controllers.
 
 One of the primary development drivers behind REM is to provide high performance access to pool related equipment and communicate with external systems without the need to write custom applications to acquire data or control the equipment.
 
 ## Architecture
 REM uses nodejs as its primary development platform.  Communication can be performed through configurable MQTT, websocket, or HTTP Rest APIs.  The data interface is exposed through the built in web interface for REM.  Inputs and outputs in REM are described as Triggers (inputs) and Feeds (outputs).  These are routed through a connection manager that can be configured within the web interface.
 
 # Installation
 To install relayEquipmentManager clone the repository to either a Raspberry Pi or BeagleBone.  While you can install this software on other platforms to try it out the GPIO functions will not do anything.  All that will happen is the node console will show feedback to simulate GPIO operations.

After you have cloned the repository run ```npm install``` or ```sudo npm install``` in the cloned directory depending on the permissions assigned to the user on your linux console.  Once completed run ```npm start``` or ```sudo npm start``` to start the relayEquipmentManager server.

# System Configuration
relayEquipmentManager server includes a web server for configuration of connection sources, triggers, and data feeds.  The default port for this server is :8080 on with the address being the IP address for the Raspberry Pi or BeagleBone.  To access this web application, open a browser, and type ```http://<ip address>:8080``` for default Raspberry Pi installations you can use the name of the Pi for the ip address.
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

# Software Configuration
Configuration of hardwared devices in REM is straightforward with each exposed hardware interface represented by tabs at the top of the page.  To enable communication with I2c and SPI bus topologies you must first enable them in the OS for Raspberry Pi, Orange Pi, or BeagleBone.  Once you have done that you can add the bus access from the General tab.

