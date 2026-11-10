const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Redis Client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// ====================
// HEALTH CHECK ENDPOINT
// ====================
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend is running successfully' });
});

// ====================
// STORE INFO ENDPOINT
// ====================
app.get('/api/store-info', async (req, res) => {
  try {
    const data = await redisClient.get('store:info');
    if (!data) {
      return res.status(404).json({ error: 'Store information not found' });
    }
    res.status(200).json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch store information' });
  }
});

// ====================
// MENU ENDPOINTS
// ====================

// GET: Retrieve all menu items (Optimized with Sets)
app.get('/api/menu', async (req, res) => {
  try {
    const ids = await redisClient.sMembers('menu:ids');
    const menuItems = [];
    for (const id of ids) {
      const data = await redisClient.get(`menu:${id}`);
      if (data) menuItems.push(JSON.parse(data));
    }
    res.status(200).json(menuItems);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

// GET: Retrieve one menu item by ID
app.get('/api/menu/:id', async (req, res) => {
  try {
    const data = await redisClient.get(`menu:${req.params.id}`);
    if (!data) return res.status(404).json({ error: 'Menu item not found' });
    res.status(200).json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

// POST: Add a new menu item
app.post('/api/menu', async (req, res) => {
  try {
    const { name, description, price, available, image } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    const id = Date.now().toString();
    const newItem = {
      id,
      name,
      description: description || '',
      price: parseFloat(price),
      available: available !== undefined ? available : true,
      image: image || ''
    };

    await redisClient.set(`menu:${id}`, JSON.stringify(newItem));
    await redisClient.sAdd('menu:ids', id); // Track ID in Set for lightning-fast retrieval
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// PUT: Update an existing menu item
app.put('/api/menu/:id', async (req, res) => {
  try {
    const key = `menu:${req.params.id}`;
    const existingData = await redisClient.get(key);
    if (!existingData) return res.status(404).json({ error: 'Menu item not found' });

    const item = JSON.parse(existingData);
    const { name, description, price, available, image } = req.body;

    const updatedItem = {
      ...item,
      name: name !== undefined ? name : item.name,
      description: description !== undefined ? description : item.description,
      price: price !== undefined ? parseFloat(price) : item.price,
      available: available !== undefined ? available : item.available,
      image: image !== undefined ? image : item.image
    };

    await redisClient.set(key, JSON.stringify(updatedItem));
    res.status(200).json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// DELETE: Delete a menu item
app.delete('/api/menu/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const key = `menu:${itemId}`;
    const existingData = await redisClient.get(key);
    if (!existingData) return res.status(404).json({ error: 'Menu item not found' });

    await redisClient.del(key);
    await redisClient.sRem('menu:ids', itemId); // Remove ID from tracking set
    res.status(200).json({ message: 'Item deleted successfully', deletedItem: JSON.parse(existingData) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

// ====================
// ORDER ENDPOINTS
// ====================

// GET: Retrieve customer orders (Optimized with Sets)
app.get('/api/orders', async (req, res) => {
  try {
    const ids = await redisClient.sMembers('order:ids');
    const orders = [];
    for (const id of ids) {
      const data = await redisClient.get(`order:${id}`);
      if (data) orders.push(JSON.parse(data));
    }
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve orders' });
  }
});

// GET: Retrieve a specific order
app.get('/api/orders/:id', async (req, res) => {
  try {
    const data = await redisClient.get(`order:${req.params.id}`);
    if (!data) return res.status(404).json({ error: 'Order not found' });
    res.status(200).json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve order' });
  }
});

// POST: Place a customer order
app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, items, totalAmount } = req.body;
    if (!customerName || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer name and items are required' });
    }

    const id = 'ORD-' + Date.now();
    const newOrder = {
      id,
      customerName,
      items,
      totalAmount: totalAmount || 0,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    await redisClient.set(`order:${id}`, JSON.stringify(newOrder));
    await redisClient.sAdd('order:ids', id); // Track order ID in Set
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// PATCH: Update order status
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Preparing', 'Ready', 'Collected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value provided' });
    }

    const key = `order:${req.params.id}`;
    const data = await redisClient.get(key);
    if (!data) return res.status(404).json({ error: 'Order not found' });

    const order = JSON.parse(data);
    order.status = status;

    await redisClient.set(key, JSON.stringify(order));
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// DELETE: Clear uncollected orders older than 24 hours
app.delete('/api/orders/clear-expired', async (req, res) => {
  try {
    const ids = await redisClient.sMembers('order:ids');
    const now = new Date().getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const id of ids) {
      const key = `order:${id}`;
      const data = await redisClient.get(key);
      if (data) {
        const order = JSON.parse(data);
        const orderTime = new Date(order.createdAt).getTime();
        
        // If older than 24 hours and not collected, delete it
        if ((now - orderTime) > oneDayMs && order.status !== 'Collected') {
          await redisClient.del(key);
          await redisClient.sRem('order:ids', id); // Remove from tracking set
          deletedCount++;
        }
      }
    }
    res.status(200).json({ message: `Successfully cleared ${deletedCount} uncollected order(s) older than 24 hours.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear expired orders' });
  }
});

// ====================
// START SERVER WITH REDIS
// ====================
async function startServer() {
  try {
    await redisClient.connect();
    console.log('Connected to Redis successfully');

    // Automatically seed default store info if it doesn't exist
    const storeCheck = await redisClient.get('store:info');
    if (!storeCheck) {
      const defaultStoreInfo = {
        name: "Campus Brew & Pastry",
        tagline: "Fresh coffee and treats for students and staff",
        openingHours: "Mon - Fri: 07:30 AM - 17:00 PM",
        location: "Main Student Center",
        contact: "+266 2222 3333"
      };
      await redisClient.set('store:info', JSON.stringify(defaultStoreInfo));
      console.log('Default store info seeded into Redis.');
    }

    // Automatically seed default menu items if the set is empty
    const existingMenuCount = await redisClient.sCard('menu:ids');
    if (existingMenuCount === 0) {
      const defaultItems = [
        { id: '1', name: 'Cappuccino', description: 'Rich espresso with steamed milk foam', price: 25.00, available: true, image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=500&q=80' },
        { id: '2', name: 'Latte', description: 'Smooth espresso with lots of steamed milk', price: 28.00, available: true, image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=500&q=80' },
        { id: '3', name: 'Classic Earl Grey Tea', description: 'Fragrant black tea infused with bergamot oil', price: 18.00, available: true, image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=500&q=80' },
        { id: '4', name: 'Buttery Croissant', description: 'Flaky, freshly baked French pastry', price: 20.00, available: true, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=500&q=80' },
        { id: '5', name: 'Chocolate Fudge Cake', description: 'Decadent multi-layer chocolate sponge cake slice', price: 35.00, available: true, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=500&q=80' },
        { id: '6', name: 'Strudel', description: 'paper thin dough layers', price: 22.00, available: true, image: 'https://tse4.mm.bing.net/th/id/OIP.WJVaKu6JLlMg7G6V66sbwQHaE8?r=0&rs=1&pid=ImgDetMain&o=7&rm=3' }
      ];
      for (let item of defaultItems) {
        await redisClient.set(`menu:${item.id}`, JSON.stringify(item));
        await redisClient.sAdd('menu:ids', item.id);
      }
      console.log('Default menu items seeded into Redis.');
    }

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
}

startServer();