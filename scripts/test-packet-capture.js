const axios = require('axios');

const BASE_URL = 'http://localhost:8080';

async function testPacketCaptureEndpoints() {
    console.log('Testing Packet Capture Endpoints...\n');

    try {
        // Test 1: Check initial status
        console.log('1. Checking initial packet capture status...');
        const statusResponse = await axios.get(`${BASE_URL}/config/packetCapture/status`);
        console.log('Status:', statusResponse.data);
        console.log('');

        // Test 2: Start packet capture
        console.log('2. Starting packet capture...');
        const startResponse = await axios.put(`${BASE_URL}/config/packetCapture/start`);
        console.log('Start Response:', startResponse.data);
        console.log('');

        // Test 3: Check status after start
        console.log('3. Checking status after start...');
        const statusAfterStart = await axios.get(`${BASE_URL}/config/packetCapture/status`);
        console.log('Status after start:', statusAfterStart.data);
        console.log('');

        // Test 4: Try to start again (should fail)
        console.log('4. Trying to start packet capture again (should fail)...');
        try {
            const startAgainResponse = await axios.put(`${BASE_URL}/config/packetCapture/start`);
            console.log('Unexpected success:', startAgainResponse.data);
        } catch (error) {
            console.log('Expected error:', error.response.data);
        }
        console.log('');

        // Test 5: Get log content
        console.log('5. Getting packet capture log...');
        const logResponse = await axios.get(`${BASE_URL}/config/packetCapture/log`);
        console.log('Log Response:', {
            success: logResponse.data.success,
            logFile: logResponse.data.logFile,
            isActive: logResponse.data.isActive,
            logContentLength: logResponse.data.logContent ? logResponse.data.logContent.length : 0
        });
        console.log('');

        // Test 6: Stop packet capture
        console.log('6. Stopping packet capture...');
        const stopResponse = await axios.put(`${BASE_URL}/config/packetCapture/stop`);
        console.log('Stop Response:', stopResponse.data);
        console.log('');

        // Test 7: Check final status
        console.log('7. Checking final status...');
        const finalStatus = await axios.get(`${BASE_URL}/config/packetCapture/status`);
        console.log('Final Status:', finalStatus.data);
        console.log('');

        // Test 8: Try to stop again (should fail)
        console.log('8. Trying to stop packet capture again (should fail)...');
        try {
            const stopAgainResponse = await axios.put(`${BASE_URL}/config/packetCapture/stop`);
            console.log('Unexpected success:', stopAgainResponse.data);
        } catch (error) {
            console.log('Expected error:', error.response.data);
        }
        console.log('');

        console.log('All tests completed successfully!');

    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the tests
testPacketCaptureEndpoints(); 