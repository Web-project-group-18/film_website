const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,      
    port: process.env.DB_PORT,      
    database: (process.env.NODE_ENV === 'test') ? process.env.DB_NAME_TEST : process.env.DB_NAME,  
    user: process.env.DB_USER,      
    password: process.env.DB_PASSWORD, 
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Tietokantayhteys epäonnistui:', err.stack);
        console.error('Tarkista .env tiedoston tiedot!');
    } else {
        console.log('Yhdistetty PostgreSQL-tietokantaan');
        release(); 
    }
});

module.exports = pool;