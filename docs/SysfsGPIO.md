# Sysfs GPIO Support for Raspberry Pi

## Overview

Starting with Raspberry Pi OS Bookworm (and some Bullseye installations), the sysfs GPIO interface is disabled by default in favor of the newer `libgpiod` interface. However, the `onoff` module used by this application requires sysfs GPIO to function properly.

## Automatic Detection and Enabling

The application now includes automatic detection and enabling of sysfs GPIO:

### Detection
- Checks if `/sys/class/gpio` exists
- Verifies write permissions to `/sys/class/gpio/export`
- Detects Raspberry Pi hardware and OS version
- Reports onoff module accessibility

### Automatic Enabling Methods
The application attempts to enable sysfs GPIO in the following order:

1. **raspi-config** (Recommended)
   - Uses: `raspi-config nonint do_gpio 0`
   - Most reliable method

2. **Device Tree Overlay**
   - Adds: `dtoverlay=gpio-no-irq` to `/boot/config.txt`
   - Requires reboot to take effect

3. **Direct sysfs Test**
   - Tests direct access to sysfs GPIO
   - Exports and unexports a test pin

## Manual Enabling

If automatic enabling fails, you can manually enable sysfs GPIO:

### Method 1: raspi-config (Recommended)
```bash
sudo raspi-config
```
Navigate to: **Interface Options** > **GPIO** > **Yes**

### Method 2: Command Line
```bash
sudo raspi-config nonint do_gpio 0
```

### Method 3: Edit config.txt
Add this line to `/boot/config.txt`:
```
dtoverlay=gpio-no-irq
```
Then reboot:
```bash
sudo reboot
```

## Checking Status

### Web Interface
Access the GPIO status endpoint:
```
GET /config/gpio/status
```

This returns:
```json
{
  "sysfsAvailable": true,
  "sysfsWritable": true,
  "onoffAccessible": true,
  "platform": "linux",
  "isRaspberryPi": true,
  "osInfo": "Raspberry Pi OS Bookworm",
  "recommendations": ["GPIO interface appears to be working correctly."]
}
```

### Command Line
Check sysfs GPIO manually:
```bash
# Check if sysfs GPIO exists
ls -la /sys/class/gpio/

# Test write access
echo 1 | sudo tee /sys/class/gpio/export

# Check if onoff module works
node -e "console.log(require('onoff').Gpio.accessible)"
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Run the application with `sudo`
   - Or add your user to the `gpio` group

2. **Sysfs GPIO Not Found**
   - Ensure you're on a Raspberry Pi
   - Check if running on a supported OS version

3. **onoff Module Not Accessible**
   - Verify sysfs GPIO is enabled
   - Check if the `onoff` module is properly installed
   - Ensure no other processes are using GPIO

### Log Messages

The application logs detailed information about GPIO initialization:

```
[INFO] Attempting to enable sysfs GPIO interface...
[INFO] Successfully enabled sysfs GPIO via raspi-config
[INFO] GPIO interface is accessible via onoff module
```

Or if issues occur:

```
[WARN] Sysfs GPIO not available, attempting to enable...
[ERROR] Failed to enable sysfs GPIO. GPIO functionality may not work properly.
[INFO] To enable sysfs GPIO manually:
[INFO] 1. Run: sudo raspi-config
[INFO] 2. Navigate to: Interface Options > GPIO
[INFO] 3. Select: Yes (to enable sysfs GPIO)
[INFO] 4. Reboot the system
```

## Board Support

This functionality is specifically designed for:
- **Raspberry Pi (Bookworm)** - Pi 4B or Pi 5 running Bookworm OS
- **Raspberry Pi 5** - Pi 5 with its specific GPIO numbering system
- Other Raspberry Pi models with newer OS versions

Legacy Raspberry Pi OS versions (Buster and earlier) typically have sysfs GPIO enabled by default.

## Board Type Naming Convention

The application uses the following board types based on GPIO numbering system:

| Board Type | Description | GPIO Numbering | Compatible Hardware |
|------------|-------------|----------------|-------------------|
| `raspi` | Raspberry Pi (Legacy) | BCM 2 = `gpioId: 2` | All Pi models with legacy OS |
| `raspi-bookworm` | Raspberry Pi (Bookworm) | BCM 2 = `gpioId: 514` | Pi 4B or Pi 5 with Bookworm |
| `raspi-5` | Raspberry Pi 5 | BCM 2 = `gpioId: 602` | Pi 5 only |
| `opi` | Orange Pi | Various | Orange Pi models |
| `beagle` | BeagleBone Black | Various | BeagleBone models |

## Technical Details

### Why sysfs GPIO is Needed
The `onoff` module uses the sysfs GPIO interface (`/sys/class/gpio/`) to:
- Export GPIO pins for use
- Set pin directions (input/output)
- Read and write pin states
- Monitor pin changes (edge detection)

### Alternative Interfaces
While `libgpiod` is the newer, preferred GPIO interface, the `onoff` module doesn't support it yet. Future versions of this application may add `libgpiod` support as an alternative. 