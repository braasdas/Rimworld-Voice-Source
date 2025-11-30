// Test script to verify resetHealth method exists
const keyPoolManager = require('./services/keyPoolManager');

console.log('Testing keyPoolManager methods:');
console.log('================================');
console.log('selectKey:', typeof keyPoolManager.selectKey);
console.log('pauseKey:', typeof keyPoolManager.pauseKey);
console.log('resumeKey:', typeof keyPoolManager.resumeKey);
console.log('resetHealth:', typeof keyPoolManager.resetHealth);
console.log('addKey:', typeof keyPoolManager.addKey);
console.log('================================');

if (typeof keyPoolManager.resetHealth === 'function') {
    console.log('✅ SUCCESS: resetHealth method exists and is a function!');
} else {
    console.log('❌ ERROR: resetHealth method is missing or not a function!');
}
