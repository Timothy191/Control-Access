import sys

file_path = "/home/tim/Desktop/01.mine-management-system/QrMobile/App.js"
with open(file_path, "r") as f:
    content = f.read()

target = """    // Vibrate on scan
    Vibration.vibrate(50);

    // Check for expired dates in QR payload (client-side denial)"""

replacement = """    // Vibrate on scan
    Vibration.vibrate(50);

    // --- AUTO-CONFIGURATION CHECK ---
    // If the QR contains an InfoWedge URL or a specific config payload
    if (typeof data === 'string' && data.startsWith('http://') && data.includes('/api/config')) {
      try {
        const urlParts = data.replace('http://', '').split('/')[0].split(':');
        const extractedIp = urlParts[0];
        const extractedPort = urlParts[1] || '8080';
        
        console.log(`🔧 Auto-configuring from URL: IP=${extractedIp}, Port=${extractedPort}`);
        
        // Update settings
        setServerIp(extractedIp);
        setServerPort(extractedPort);
        setSavedSettings({ ip: extractedIp, port: extractedPort });
        
        // Use AsyncStorage (already imported in App.js)
        AsyncStorage.setItem('@qr_scanner_server_ip', extractedIp);
        AsyncStorage.setItem('@qr_scanner_server_port', extractedPort);
        
        showResult(
          RESULT_TYPES.SUCCESS, 
          '⚙️ APP CONFIGURED', 
          `Server automatically set to ${extractedIp}:${extractedPort}\\n\\nReady to scan!`
        );
        
        // Reset scan state after delay
        scanTimeoutRef.current = setTimeout(() => {
          setScanned(false);
          setIsProcessing(false);
          processingRef.current = false;
        }, 3000);
        return;
      } catch (err) {
        console.error("Config parse error", err);
      }
    }

    // Check for expired dates in QR payload (client-side denial)"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w") as f:
        f.write(content)
    print("Auto-config patched successfully!")
else:
    print("Auto-config Target not found.")

target2 = """              {/* Action Buttons */}
              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.saveButton]} 
                  onPress={saveSettings}
                >
                  <Text style={styles.actionButtonText}>💾 Save & Test</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, styles.cancelButton]} 
                  onPress={() => setSettingsVisible(false)}
                >
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>"""

replacement2 = """              {/* Action Buttons */}
              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.saveButton]} 
                  onPress={saveSettings}
                >
                  <Text style={styles.actionButtonText}>💾 Save & Test</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, styles.cancelButton]} 
                  onPress={() => setSettingsVisible(false)}
                >
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              
              {/* Phone Settings Shortcut */}
              <TouchableOpacity 
                style={[styles.actionButton, {backgroundColor: '#333', marginTop: 15, width: '100%', borderColor: '#555'}]} 
                onPress={() => Linking.openSettings()}
              >
                <Text style={[styles.actionButtonText, {color: '#aaa'}]}>📱 Open Phone System Settings</Text>
              </TouchableOpacity>"""

if target2 in content:
    content = content.replace(target2, replacement2)
    with open(file_path, "w") as f:
        f.write(content)
    print("Phone Settings button patched successfully!")
else:
    print("Phone Settings Target not found.")

