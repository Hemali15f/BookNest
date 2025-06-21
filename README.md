# BookNest
AI BookNest is a full-stack AI-powered online bookstore that allows users to browse, search, filter, and purchase books, while also offering an admin panel to manage the book inventory.

The frontend is built with React + TypeScript + Tailwind CSS, offering smooth UI transitions via Framer Motion and icons from Lucide. The backend uses Node.js + Express and a SQLite database (which can be scaled to MySQL or PostgreSQL). Book data is imported via CSV and includes full CRUD operations for administrators.

The goal is to create a responsive, maintainable, and intelligent bookstore experience.

📘 Features
🛍️ User Features
Browse a huge catalog of books with grid/list toggle view

Search books by title, author, or description

Filter by category and sort by title, author, price, or rating

Add books to a cart (uses React Context API)

View detailed information for each book

🛠️ Admin Panel
Add, edit, delete books

Filter/search by category or keywords

Modal-based book editing forms

Stock quantity management and ISBN info

⚙️ Backend (Node.js + SQLite)
RESTful APIs (/api/books, /api/categories, /api/admin/books)

Search, filter, and sort books

Secure admin endpoints

CSV data import with csv-parser and UUIDs for book IDs

🛠️ Future Enhancements

🔍 AI Recommendations (via OpenAI or HuggingFace APIs)

📊 Analytics for admin dashboard

📦 Pagination & infinite scroll

🔐 JWT-based authentication with user roles

📱 PWA mobile app version

🧠 GPT chatbot for book Q&A

