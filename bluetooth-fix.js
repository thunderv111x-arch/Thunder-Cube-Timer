// ============================================
// BLUETOOTH TIMER - GAN & QiYi Smart Timer
// ============================================

// UUID for GAN Smart Timer & QiYi
const BT_UUIDS = {
  // GAN Smart Timer (แนว ESP32)
  SERVICE: {
    GAN: '0000fee7-0000-1000-8000-00805f9b34fb',  // GAN service
    QIYI: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // QiYi Bluetooth service (NUS)
  },
  CHARACTERISTIC: {
    GAN_TIME: '000036f5-0000-1000-8000-00805f9b34fb',   // GAN time data (notify)
    QIYI_RX: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',    // QiYi RX
    QIYI_TX: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',    // QiYi TX
  }
};

let btDevice = null;
let btServer = null;
let btService = null;
let btChar = null;
let btConnected = false;

async function connectBluetoothTimer() {
  try {
    // Step 1: Request device (让用户选择设备)
    console.log('📱 Requesting BLE device...');
    
    btDevice = await navigator.bluetooth.requestDevice({
      filters: [
        { name: 'GAN' },
        { name: 'GAN-SmartTimer' },
        { namePrefix: 'QiYi' }
      ],
      optionalServices: [
        BT_UUIDS.SERVICE.GAN,
        BT_UUIDS.SERVICE.QIYI
      ]
    });

    console.log('✅ Device selected:', btDevice.name);
    updateBtStatus(`已选择: ${btDevice.name}`, 'ok');

    // Step 2: Connect to GATT Server
    console.log('🔗 Connecting to GATT server...');
    btServer = await btDevice.gatt.connect();
    console.log('✅ GATT server connected');
    updateBtStatus('已连接到GATT', 'ok');

    // Step 3: Try to get service (自动检测GAN或QiYi)
    let serviceUUID = null;
    let charUUID = null;

    try {
      btService = await btServer.getPrimaryService(BT_UUIDS.SERVICE.GAN);
      serviceUUID = BT_UUIDS.SERVICE.GAN;
      charUUID = BT_UUIDS.CHARACTERISTIC.GAN_TIME;
      console.log('✅ GAN Service found');
      updateBtStatus('找到GAN服务', 'ok');
    } catch (e) {
      console.log('⚠️ GAN service not found, trying QiYi...');
      try {
        btService = await btServer.getPrimaryService(BT_UUIDS.SERVICE.QIYI);
        serviceUUID = BT_UUIDS.SERVICE.QIYI;
        charUUID = BT_UUIDS.CHARACTERISTIC.QIYI_TX;
        console.log('✅ QiYi Service found');
        updateBtStatus('找到QiYi服务', 'ok');
      } catch (e2) {
        throw new Error('Neither GAN nor QiYi service found. Available services: ' + 
          (await btServer.getPrimaryServices()).map(s => s.uuid).join(', '));
      }
    }

    // Step 4: Get characteristic
    console.log(`📡 Getting characteristic ${charUUID}...`);
    btChar = await btService.getCharacteristic(charUUID);
    console.log('✅ Characteristic found');

    // Step 5: Subscribe to notifications
    if (btChar.properties.notify) {
      await btChar.startNotifications();
      btChar.addEventListener('characteristicvaluechanged', onTimerValueChanged);
      console.log('🔔 Notifications enabled');
      updateBtStatus(`已连接 - ${btDevice.name}`, 'ok');
    }

    // Step 6: Handle device disconnect
    btDevice.addEventListener('gattserverdisconnected', onBluetoothDisconnected);

    btConnected = true;
    document.getElementById('btConnectBtn').classList.add('connected');
    document.getElementById('btConnectBtn').textContent = '✅ 已连接智能计时器';

  } catch (error) {
    console.error('❌ Bluetooth Error:', error);
    updateBtStatus(`错误: ${error.message}`, 'err');
    btConnected = false;
  }
}

function onTimerValueChanged(event) {
  const value = event.target.value;
  
  // Parse timer data (different formats for GAN vs QiYi)
  let timeMs = null;

  if (btDevice.name && btDevice.name.includes('GAN')) {
    // GAN format: 4-byte little-endian uint32 (milliseconds)
    timeMs = value.getUint32(0, true);
  } else {
    // QiYi format: could be string or binary
    let text = new TextDecoder().decode(value);
    if (!isNaN(parseFloat(text))) {
      timeMs = Math.round(parseFloat(text) * 100); // Assume centiseconds
    }
  }

  if (timeMs !== null && timeMs > 0) {
    console.log(`⏱️ Timer received: ${(timeMs / 1000).toFixed(2)}s`);
    
    // Automatically save if timer was running
    if (state === 'running') {
      handleTimerComplete(timeMs);
    }
  }
}

function handleTimerComplete(timeMs) {
  cancelAnimationFrame(rafId);
  const penalty = pendingPenalty;
  pendingPenalty = 0;
  
  let elapsed = timeMs;
  if (penalty) elapsed += penalty * 1000;
  
  display.textContent = formatTime(elapsed) + (penalty ? ' (+2)' : '');
  display.classList.remove('go');
  state = 'idle';
  
  saveTime(elapsed, false, penalty);
  newScramble();
  
  // Show notification
  updateBtStatus(`記錄: ${formatTime(elapsed)}`, 'ok');
}

function onBluetoothDisconnected(event) {
  console.log('⚠️ Device disconnected:', event.target.name);
  btConnected = false;
  btDevice = null;
  btServer = null;
  btService = null;
  btChar = null;
  
  document.getElementById('btConnectBtn').classList.remove('connected');
  document.getElementById('btConnectBtn').textContent = '🔗 連接藍牙計時器';
  updateBtStatus('已断开连接', 'err');
}

function updateBtStatus(msg, status) {
  const statusEl = document.getElementById('btStatus');
  statusEl.textContent = msg;
  statusEl.className = status; // 'ok' or 'err'
}

// Hook into existing code
document.getElementById('btConnectBtn').addEventListener('click', connectBluetoothTimer);

console.log('🚀 Bluetooth module loaded - Ready for GAN/QiYi Smart Timer');
