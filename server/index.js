import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import csv from 'csv-parser';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = '831fb80ec1250a38953b9e38f950e62b';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// Database setup
const db = new sqlite3.Database('bookstore.db');

function loadBooksFromCSV() {
  const filePath = join(__dirname, 'books.csv');

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      const {
        title,
        authors,
        isbn,
        average_rating,
        image_url,
        language_code
      } = row;

      const bookId = uuidv4();

      db.run(`INSERT OR IGNORE INTO books 
        (id, title, author, description, price, category, isbn, stock_quantity, image_url, rating) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookId,
          title?.trim() || 'Untitled',
          authors?.trim() || 'Unknown',
          'No description available.',
          (Math.random() * 15 + 5).toFixed(2), // $5 to $20
          language_code || 'General',
          isbn || '',
          Math.floor(Math.random() * 91) + 10, // 10–100 units
          image_url || '',
          parseFloat(average_rating) || 0
        ]
      );
    })
    .on('end', () => {
      console.log('✅ Goodreads books imported successfully.');
    })
    .on('error', (err) => {
      console.error('❌ Error loading books.csv:', err);
    });
}


// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Books table
  db.run(`CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    isbn TEXT,
    stock_quantity INTEGER DEFAULT 0,
    image_url TEXT,
    rating REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Orders table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'pending',
    shipping_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Order items table
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders (id),
    FOREIGN KEY (book_id) REFERENCES books (id)
  )`);

  // Cart table
  db.run(`CREATE TABLE IF NOT EXISTS cart (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (book_id) REFERENCES books (id)
  )`);

  // Reviews table
  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (book_id) REFERENCES books (id)
  )`);

  loadBooksFromCSV();

  

  // Insert sample admin user
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (id, email, password, name, role) 
          VALUES ('admin-1', 'admin@bookstore.com', ?, 'Admin User', 'admin')`, [adminPassword]);

  // Insert sample books

  sampleBooks.forEach(book => {
    db.run(`INSERT OR IGNORE INTO books (id, title, author, description, price, category, isbn, stock_quantity, image_url, rating) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [book.id, book.title, book.author, book.description, book.price, book.category, book.isbn, book.stock_quantity, book.image_url, book.rating]);
  });
});

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'server/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Auth routes
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  const userId = uuidv4();

  db.run('INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)', 
    [userId, email, hashedPassword, name], 
    function(err) {
      if (err) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      const token = jwt.sign({ userId, email, role: 'user' }, JWT_SECRET);
      res.json({ token, user: { id: userId, email, name, role: 'user' } });
    });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });
});

// Books routes
app.get('/api/books', (req, res) => {
  const { category, search, sortBy = 'title', order = 'ASC', page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let query = 'SELECT * FROM books WHERE 1=1';
  const params = [];

  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND (title LIKE ? OR author LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, books) => {
    if (err) return res.status(500).json({ error: err.message });

    db.get('SELECT COUNT(*) AS total FROM books', [], (countErr, countResult) => {
      if (countErr) return res.status(500).json({ error: countErr.message });

      res.json({
        books,
        total: countResult.total,
        page: parseInt(page),
        totalPages: Math.ceil(countResult.total / limit)
      });
    });
  });
});



app.get('/api/books/:id', (req, res) => {
  db.get('SELECT * FROM books WHERE id = ?', [req.params.id], (err, book) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json(book);
  });
});

// AI-powered book recommendations
app.get('/api/books/recommendations/:userId', authenticateToken, (req, res) => {
  // Simple AI recommendation based on user's order history and ratings
  const query = `
    SELECT DISTINCT b.* FROM books b
    JOIN order_items oi ON b.id = oi.book_id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.user_id = ? AND b.rating >= 4.0
    ORDER BY b.rating DESC, RANDOM()
    LIMIT 6
  `;

  db.all(query, [req.params.userId], (err, books) => {
    if (err || books.length === 0) {
      // Fallback to popular books
      db.all('SELECT * FROM books ORDER BY rating DESC, RANDOM() LIMIT 6', (err, fallbackBooks) => {
        res.json(fallbackBooks || []);
      });
    } else {
      res.json(books);
    }
  });
});

// Admin book management
app.post('/api/admin/books', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
  const { title, author, description, price, category, isbn, stock_quantity } = req.body;
  const bookId = uuidv4();
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  db.run('INSERT INTO books (id, title, author, description, price, category, isbn, stock_quantity, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
    [bookId, title, author, description, price, category, isbn, stock_quantity, imageUrl], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: bookId, title, author, description, price, category, isbn, stock_quantity, image_url: imageUrl });
    });
});

app.put('/api/admin/books/:id', authenticateToken, requireAdmin, (req, res) => {
  const { title, author, description, price, category, isbn, stock_quantity } = req.body;
  
  db.run('UPDATE books SET title = ?, author = ?, description = ?, price = ?, category = ?, isbn = ?, stock_quantity = ? WHERE id = ?', 
    [title, author, description, price, category, isbn, stock_quantity, req.params.id], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Book updated successfully' });
    });
});

app.delete('/api/admin/books/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run('DELETE FROM books WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Book deleted successfully' });
  });
});

// Cart routes
app.get('/api/cart', authenticateToken, (req, res) => {
  const query = `
    SELECT c.*, b.title, b.author, b.price, b.image_url 
    FROM cart c 
    JOIN books b ON c.book_id = b.id 
    WHERE c.user_id = ?
  `;
  
  db.all(query, [req.user.userId], (err, cartItems) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(cartItems);
  });
});

app.post('/api/cart', authenticateToken, (req, res) => {
  const { bookId, quantity } = req.body;
  const cartId = uuidv4();

  db.run('INSERT OR REPLACE INTO cart (id, user_id, book_id, quantity) VALUES (?, ?, ?, ?)', 
    [cartId, req.user.userId, bookId, quantity], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Item added to cart' });
    });
});

app.delete('/api/cart/:bookId', authenticateToken, (req, res) => {
  db.run('DELETE FROM cart WHERE user_id = ? AND book_id = ?', 
    [req.user.userId, req.params.bookId], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Item removed from cart' });
    });
});

// Orders routes
app.post('/api/orders', authenticateToken, (req, res) => {
  const { items, totalAmount, shippingAddress } = req.body;
  const orderId = uuidv4();

  db.run('INSERT INTO orders (id, user_id, total_amount, shipping_address) VALUES (?, ?, ?, ?)', 
    [orderId, req.user.userId, totalAmount, shippingAddress], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      // Add order items
      const stmt = db.prepare('INSERT INTO order_items (id, order_id, book_id, quantity, price) VALUES (?, ?, ?, ?, ?)');
      items.forEach(item => {
        stmt.run([uuidv4(), orderId, item.bookId, item.quantity, item.price]);
      });
      stmt.finalize();

      // Clear cart
      db.run('DELETE FROM cart WHERE user_id = ?', [req.user.userId]);

      res.json({ orderId, message: 'Order placed successfully' });
    });
});

app.get('/api/orders', authenticateToken, (req, res) => {
  const query = `
    SELECT o.*, 
           GROUP_CONCAT(b.title) as book_titles,
           COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN books b ON oi.book_id = b.id
    WHERE o.user_id = ?
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `;

  db.all(query, [req.user.userId], (err, orders) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(orders);
  });
});

// Admin dashboard
app.get('/api/admin/dashboard', authenticateToken, requireAdmin, (req, res) => {
  const stats = {};
  
  // Get total books
  db.get('SELECT COUNT(*) as count FROM books', (err, result) => {
    stats.totalBooks = result?.count || 0;
    
    // Get total users
    db.get('SELECT COUNT(*) as count FROM users WHERE role = "user"', (err, result) => {
      stats.totalUsers = result?.count || 0;
      
      // Get total orders
      db.get('SELECT COUNT(*) as count FROM orders', (err, result) => {
        stats.totalOrders = result?.count || 0;
        
        // Get total revenue
        db.get('SELECT SUM(total_amount) as revenue FROM orders WHERE payment_status = "completed"', (err, result) => {
          stats.totalRevenue = result?.revenue || 0;
          
          // Get recent orders
          db.all(`
            SELECT o.*, u.name as user_name, u.email as user_email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
            LIMIT 10
          `, (err, recentOrders) => {
            stats.recentOrders = recentOrders || [];
            res.json(stats);
          });
        });
      });
    });
  });
});

app.get('/api/categories', (req, res) => {
  db.all('SELECT DISTINCT category FROM books ORDER BY category', (err, categories) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(categories.map(c => c.category));
  });
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    throw err;
  }
});
