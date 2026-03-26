# Raspberry Pi GPIO Backends

## Overview

`relayEquipmentManager` now supports two GPIO backends on Linux:

1. `onoff` (sysfs backend)  
   - Uses `/sys/class/gpio`
   - Best for legacy Raspberry Pi OS setups where sysfs is still available/writable

2. `@bratbit/onoff` (libgpiod backend)  
   - Uses `/dev/gpiochip*` via libgpiod
   - Required for Raspberry Pi OS Trixie and recommended for newer kernels

The app auto-selects the backend at startup based on platform capabilities.

## Backend Selection

Default behavior:

- On `trixie`: prefers libgpiod backend
- On other Linux systems: prefers sysfs backend when writable and accessible, otherwise falls back to libgpiod

You can force selection:

```bash
REM_GPIO_BACKEND=sysfs-onoff
REM_GPIO_BACKEND=libgpiod-onoff
```

If no compatible backend is detected, startup fails fast with a clear error.

## Trixie Notes

On Raspberry Pi OS Trixie, `/sys/class/gpio` is no longer a reliable path.  
Do not rely on `raspi-config`/sysfs toggles as a fix.

Use the libgpiod path:

```bash
npm install
```

Ensure:

- `@bratbit/onoff` is installed in project dependencies
- `/dev/gpiochip*` exists
- the process user has GPIO access permissions

## Checking Status

### Web API

```text
GET /config/gpio/status
```

The response includes backend and platform diagnostics, including:

- `backendId`
- `backendName`
- `backendReason`
- `sysfsAvailable` / `sysfsWritable`
- `onoffAccessible`
- `libgpiodAccessible`
- `hasGpioCharacterDevice`
- `osCodename`

### Sysfs Enable Endpoint

```text
POST /config/gpio/enable-sysfs
```

Behavior:

- On Trixie: returns guidance to use libgpiod (does not claim sysfs can be enabled)
- On older Raspberry Pi OS: may still attempt legacy sysfs enable steps

## Pin Mapping Model

For Raspberry Pi pinout files, backend metadata is now provided:

- `gpioBackends.sysfs.base`
- `gpioBackends.libgpiod.chipRegex`
- `gpioBackends.libgpiod.lineSource`

This allows deterministic mapping from legacy sysfs global GPIO IDs to backend line offsets for libgpiod without depending on kernel-global numbering quirks.

## Board Types

| Board Type | Description | Legacy `gpioId` style |
|------------|-------------|------------------------|
| `raspi` | Raspberry Pi (Legacy) | BCM-style IDs |
| `raspi-bookworm` | Raspberry Pi (Bookworm) | sysfs global IDs (base 512) |
| `raspi-5` | Raspberry Pi 5 | sysfs global IDs (base 600) |
| `opi` | Orange Pi | platform-specific |
| `beagle` | BeagleBone Black | platform-specific |