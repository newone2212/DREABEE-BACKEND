// // db.js
// const mysql = require('mysql2');

// const connection = mysql.createConnection({
//     host: '192.155.100.47',
//     user: 'youtube',
//     password: '!qR%xf|L3@',
//     database: 'youtube'
// });

// connection.connect((err) => {
//     if (err) {
//         console.error('Error connecting to MySQL:', err);
//         return;
//     }
//     console.log('Connected to MySQL');
// });

// module.exports = connection;
// db.js
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: '192.155.100.47',
    user: 'youtube',
    password: '!qR%xf|L3@',
    database: 'youtube',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool.promise();
