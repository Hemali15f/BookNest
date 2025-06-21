const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'bookstore2' // replace with your DB name
});

connection.connect(err => {
  if (err) throw err;
  console.log('Connected to MySQL!');
  
  connection.query('SELECT * FROM books', (err, results) => {
    if (err) throw err;
    console.log(results);
  });

  connection.end();
});
