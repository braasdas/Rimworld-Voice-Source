// Add this function to admin.html after the resumeKey function

// Reset health
async function resetHealth(keyId) {
    if (!confirm('Reset this key\'s health to 100%?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/admin/keys/${keyId}/reset-health`, {
            method: 'POST',
            credentials: 'include'
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        alert('Health reset to 100%!');
        loadKeys();
        loadStats();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Also update the loadKeys() function to add the Reset Health button:
// Find this line:
//     html += `<button class="btn btn-danger" onclick="removeKey('${key.id}', '${key.key_name}')">Remove</button>`;
// 
// Change it to:
//     html += `<button class="btn btn-success" onclick="resetHealth('${key.id}')">Reset Health</button>`;
//     html += `<button class="btn btn-danger" onclick="removeKey('${key.id}', '${key.key_name}')">Remove</button>`;
