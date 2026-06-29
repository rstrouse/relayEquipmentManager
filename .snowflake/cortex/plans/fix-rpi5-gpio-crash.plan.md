# Fix: RPi5 + Trixie GPIO Crash (Pin 27 / Pin 32)

## Problem Analysis

The [latest comment on issue #114](https://github.com/rstrouse/relayEquipmentManager/issues/114#issuecomment-4827303983) from @neald-glyph reports that on RPi5 + Debian Trixie:

1. **Any GPIO change in the REM web interface causes a core dump**
2. **PIN 32 (BCM12)** crashes when Sequent SmartFan v6 tries to use it for PWM power control
3. **PIN 27 (BCM27)** crashes as soon as the GPIO relay hat is configured (Sequent hats use this pin)

### Root Cause

The crash is a **C-level assertion failure** in libgpiod's `gpiod_line_request_reconfigure_lines()` on the RP1 GPIO controller chip used by the Pi 5. This is triggered through the `@bratbit/onoff` library when `reconfigureDirection: true` is passed.

The code in `gpio/Gpio-Backends.ts:320-330` **already knows** about this bug and attempts to fall back to sysfs:

```typescript
if (platform.osCodename === "trixie") {
    if (platform.isRaspberryPi && isPi5()) {
        if (sysfsBackend && platform.sysfsWritable && sysfsBackend.isAccessible()) {
            return { backend: sysfsBackend, reason: "..." };
        }
    }
    // Falls through to libgpiod anyway!
    if (libgpiodBackend && libgpiodBackend.isAccessible()) {
        return { backend: libgpiodBackend, reason: "..." };
    }
}
```

**The gap**: Trixie has removed/disabled sysfs GPIO (`/sys/class/gpio` is not writable), so `platform.sysfsWritable` is `false`. The code then falls through to select libgpiod — the exact backend that crashes.

### Why BCM27 and BCM12 specifically?

Any pin will crash through this path — these two are just the most commonly configured:
- **BCM12 (Pin 32)**: Auto-exported by `SequentSmartFan.ts:99` during I2C device init
- **BCM27 (Pin 13)**: Used by Sequent MEGA-BAS and Smart Fan hats, configured via web UI

### Crash Flow

```
PUT /config/gpio/pin/1/22  or  SmartFan startup
  → cont.gpio.setPinAsync(...)
    → gpioCont.initPin(pinDef)
      → opts.reconfigureDirection = true  (if pin already exported with different direction)
      → createGpioInstance(pinDef, pinout, dir, edge, opts)
        → new @bratbit/onoff.Gpio(lineOffset, dir, edge, {reconfigureDirection: true})
          → gpiod_line_request_reconfigure_lines()   // C assertion failure → abort() → core dump
```

## Proposed Fix (Two-Part)

### Fix 1: Backend selection — don't fall through to crashing backend (`Gpio-Backends.ts`)

When Pi5 + Trixie is detected and sysfs is unavailable, we should still use libgpiod but **disable `reconfigureDirection`** globally, since that's the specific operation that triggers the assertion failure. We communicate this via a flag on the returned selection object.

```typescript
if (platform.osCodename === "trixie") {
    if (platform.isRaspberryPi && isPi5()) {
        if (sysfsBackend && platform.sysfsWritable && sysfsBackend.isAccessible()) {
            return { backend: sysfsBackend, reason: "Trixie on Pi 5 detected; using sysfs to avoid libgpiod crash", platform };
        }
        // sysfs unavailable — use libgpiod but flag that reconfigure is unsafe
        if (libgpiodBackend && libgpiodBackend.isAccessible()) {
            return { 
                backend: libgpiodBackend, 
                reason: "Trixie on Pi 5; using libgpiod with reconfigure workaround (sysfs unavailable)", 
                platform,
                noReconfigureDirection: true 
            };
        }
        return { backend: null, reason: "Pi 5 + Trixie: no safe GPIO backend available", platform };
    }
    // Non-Pi5 Trixie continues as before...
```

### Fix 2: Avoid `reconfigureDirection` — unexport/re-export instead (`Gpio-Controller.ts`)

When `noReconfigureDirection` is flagged (or when using the libgpiod backend on Pi5), instead of passing `reconfigureDirection: true`, unexport the existing pin and re-create it with the new direction:

```typescript
// In initPin(), around line 251:
else if (typeof pin.gpio !== 'undefined') {
    if (dir !== pin.gpio.direction()) {
        if (this.backendSelection?.noReconfigureDirection) {
            // Workaround: unexport and re-export instead of reconfigure
            try { pin.gpio.unexport(); } catch (e) { /* ignore */ }
            pin.gpio = undefined;
        } else {
            opts.reconfigureDirection = true;
        }
    }
    if (pin.gpio) pin.gpio.unwatchAll();
}
```

### Fix 3: try/catch around `createGpioInstance` (`Gpio-Controller.ts`)

Even with the above fixes, wrap the native call to prevent process crashes from unforeseen issues:

```typescript
try {
    pin.gpio = this.createGpioInstance(pinDef, pinout, stateDir, edge, opts);
} catch (err) {
    logger.error(`Failed to configure GPIO Pin #${pinDef.id} (${pinout.gpioId}): ${err.message}`);
    return pin;
}
```

### Fix 4: Guard SmartFan pin export (`SequentSmartFan.ts`)

Wrap the pin 32 auto-export in error handling so it doesn't take down the process during I2C init:

```typescript
try {
    this.powerPin = await cont.gpio.setPinAsync(1, 32, { ... });
} catch (err) {
    logger.error(`SmartFan: Could not configure power pin 32: ${err.message}`);
}
```

## Impact

- Fixes the core dump for all GPIO pin operations on Pi5 + Trixie
- BCM27 and BCM12 will work correctly (they go through the same code path as all other pins)
- Sequent SmartFan v6 will no longer crash during startup
- The fix is backward-compatible — it only changes behavior on Pi5 + Trixie when sysfs is unavailable
