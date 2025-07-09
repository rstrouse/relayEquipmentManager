# Packet Capture Endpoints for njsPC Integration

This document describes the packet capture functionality implemented in the REM (Relay Equipment Manager) application to support njsPC integration.

## Overview

The packet capture system provides three main endpoints that allow njsPC to:
1. Start packet capture with maximum logging verbosity
2. Stop packet capture and restore previous logging settings
3. Retrieve packet capture log files

## Endpoints

### 1. PUT /config/packetCapture/start

**Purpose**: Start packet capture and configure logging for maximum verbosity.

**Actions**:
- Save current logging configuration (level, file logging settings, etc.)
- Set logging level to "silly" for maximum detail
- Enable file logging if not already enabled
- Create timestamped log file for packet capture
- Store configuration for later restoration

**Request**: No body required

**Response**:
```json
{
  "success": true,
  "message": "Packet capture started successfully",
  "logFile": "packetCapture_2024-01-15T10-30-45-123Z.log"
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Packet capture is already active",
  "error": "ALREADY_ACTIVE"
}
```

### 2. PUT /config/packetCapture/stop

**Purpose**: Stop packet capture and restore previous logging settings.

**Actions**:
- Stop packet capture/monitoring
- Restore the previously saved logging configuration
- Ensure log files are properly closed/finalized
- Calculate and log capture duration

**Request**: No body required

**Response**:
```json
{
  "success": true,
  "message": "Packet capture stopped successfully",
  "logFile": "packetCapture_2024-01-15T10-30-45-123Z.log"
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Packet capture is not currently active",
  "error": "NOT_ACTIVE"
}
```

### 3. GET /config/packetCapture/log

**Purpose**: Retrieve the packet capture log file content.

**Actions**:
- Read the current packet capture log file
- Return the log content as plain text
- Handle cases where log file doesn't exist

**Request**: No parameters required

**Response**:
```json
{
  "success": true,
  "logContent": "[15/01/2024, 10:30:45] info: Packet capture started...",
  "logFile": "packetCapture_2024-01-15T10-30-45-123Z.log",
  "isActive": true
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "No packet capture log file found",
  "error": "NO_LOG_FILE"
}
```

### 4. GET /config/packetCapture/status

**Purpose**: Get the current status of packet capture.

**Request**: No parameters required

**Response**:
```json
{
  "success": true,
  "isActive": true,
  "logFile": "packetCapture_2024-01-15T10-30-45-123Z.log",
  "startTime": "2024-01-15T10:30:45.123Z"
}
```

## Implementation Details

### Logging Configuration Management

The system automatically manages logging configuration:

1. **Save Configuration**: When packet capture starts, the current logging settings are saved:
   - Log level
   - File logging enabled/disabled
   - Log file paths

2. **Apply Packet Capture Settings**: 
   - Set log level to "silly" for maximum verbosity
   - Enable file logging
   - Create timestamped log files

3. **Restore Configuration**: When packet capture stops, the original settings are restored

### Packet Capture Logging

- **Log File Naming**: `packetCapture_YYYY-MM-DDTHH-MM-SS-sssZ.log`
- **Log Level**: Set to "silly" to capture maximum detail
- **File Location**: Stored in `/logs/` directory
- **Content**: All network packets, API calls, and system events during capture

### Error Handling

The system handles various error conditions:

- **Already Active**: Prevents multiple simultaneous packet capture sessions
- **Not Active**: Prevents stopping when no capture is running
- **File Not Found**: Handles missing log files gracefully
- **Permission Issues**: Proper error messages for file operation failures

### File Management

- **Automatic Directory Creation**: Creates `/logs/` directory if it doesn't exist
- **Timestamped Files**: Each capture session gets a unique log file
- **Cleanup Functionality**: Optional cleanup of old log files (configurable)

## Integration with njsPC

### Workflow

1. **njsPC calls** `PUT /config/packetCapture/start`
2. **REM starts** packet capture with maximum logging
3. **njsPC performs** its operations (packet capture, monitoring, etc.)
4. **njsPC calls** `PUT /config/packetCapture/stop`
5. **REM restores** original logging configuration
6. **njsPC calls** `GET /config/packetCapture/log` to retrieve logs
7. **Logs are included** in njsPC backup files under `REM/logs/` directory

### Security Considerations

- No authentication required (matches existing REM endpoint pattern)
- Log files contain sensitive information - ensure proper access controls
- Consider adding authentication if needed for production use

### Performance Considerations

- Packet capture with "silly" logging can generate large log files
- Monitor disk space usage during extended capture sessions
- Consider log rotation for long-running captures

## Testing

Use the provided test script to verify functionality:

```bash
node scripts/test-packet-capture.js
```

The test script will:
1. Check initial status
2. Start packet capture
3. Verify status changes
4. Test duplicate start prevention
5. Retrieve log content
6. Stop packet capture
7. Verify final status
8. Test duplicate stop prevention

## Configuration

The packet capture system uses the existing REM logging configuration system. No additional configuration is required beyond the standard REM setup.

## Troubleshooting

### Common Issues

1. **"Packet capture is already active"**
   - Another capture session is running
   - Check status endpoint to confirm
   - Stop existing session before starting new one

2. **"No packet capture log file found"**
   - No capture session has been started
   - Log file may have been deleted manually
   - Check logs directory for existing files

3. **Permission errors**
   - Ensure REM has write permissions to `/logs/` directory
   - Check file system permissions

### Log Analysis

Packet capture logs contain detailed information about:
- All API requests and responses
- Network communication
- System events and errors
- Device interactions
- Configuration changes

Use standard log analysis tools to process the captured data. 