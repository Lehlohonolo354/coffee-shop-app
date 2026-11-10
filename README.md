# Coffee Shop Management System

A full-stack web application designed for a local coffee shop to manage its menu, customer orders, and real-time order processing.

---

## 🛠️ Tech Stack

- **Frontend:** React, Fetch API, CSS
- **Backend:** Node.js, Express.js (REST API)
- **Database:** Redis (Key-Value NoSQL Store with Persistence)
- **Deployment:** Render (Backend), Vercel (Frontend)

---

## 📋 REST API Endpoints

| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/menu` | Retrieve all menu items |
| `GET` | `/api/menu/:id` | Retrieve single menu item |
| `POST` | `/api/menu` | Add a new menu item |
| `PUT` | `/api/menu/:id` | Update an existing menu item |
| `DELETE` | `/api/menu/:id` | Remove a menu item |
| `GET` | `/api/orders` | Retrieve all customer orders |
| `GET` | `/api/orders/:id` | Retrieve a specific order |
| `POST` | `/api/orders` | Submit a new customer order |
| `PATCH` | `/api/orders/:id/status` | Update order status |
| `GET` | `/api/health` | Backend server health check |

---

## 🚀 Setup & Installation Instructions

### Prerequisites
- Node.js installed locally
- Redis server running locally or a hosted Redis instance connection URL

### 1. Backend Setup
```bash
cd backend
npm install
npm start