require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function runMigration() {
    try {
        console.log('Reading migration file...');
        const sql = fs.readFileSync('./add_proxy_support.sql', 'utf8');
        
        console.log('Connecting to database...');
        const client = await pool.connect();
        
        console.log('Running migration...');
        await client.query(sql);
        
        console.log('✓ Migration completed successfully!');
        console.log('Proxies table created.');
        
        client.release();
        process.exit(0);
    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
