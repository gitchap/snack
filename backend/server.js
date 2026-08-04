require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- REST API ---

app.post('/api/auth/login', async (req, res) => {
  const { username, pin } = req.body;
  if (!username || !pin) return res.status(400).json({ error: 'Username and PIN required' });
  
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  const valid = await bcrypt.compare(pin, user.pin);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, role: user.role });
});

// Admin REST API for Menu Items (Protected)
app.post('/api/admin/menu', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { name, price, categoryId } = req.body;
  const item = await prisma.menuItem.create({ data: { name, price, categoryId } });
  res.json(item);
});

// Get Menu (Public/Kiosk accessible)
app.get('/api/menu', async (req, res) => {
  const categories = await prisma.category.findMany({
    include: {
      menuItems: {
        include: {
          options: true
        }
      }
    }
  });
  res.json(categories);
});

// Get Active Orders
app.get('/api/orders/active', async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { status: 'active' },
    include: {
      orderItems: {
        include: { menuItem: true }
      }
    }
  });
  res.json(orders);
});

// --- Socket.IO ---
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('place_order', async (data) => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0,0,0,0);
      
      const count = await prisma.order.count({
        where: { createdAt: { gte: startOfDay } }
      });
      const orderNumber = count + 1;

      const newOrder = await prisma.order.create({
        data: {
          orderNumber,
          orderItems: {
            create: data.items.map(item => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              optionsSnapshot: JSON.stringify(item.optionsSnapshot || {})
            }))
          }
        },
        include: {
          orderItems: {
            include: { menuItem: true }
          }
        }
      });
      
      io.emit('new_order', newOrder);
    } catch (e) {
      console.error(e);
      socket.emit('order_error', { error: 'Failed to place order' });
    }
  });

  socket.on('update_kitchen_status', async ({ orderId, status }) => {
    try {
      const order = await prisma.order.update({
        where: { id: orderId },
        data: { kitchenStatus: status },
        include: {
          orderItems: {
            include: { menuItem: true }
          }
        }
      });
      io.emit('order_updated', order);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('fulfill_item', async ({ itemId }) => {
    try {
      const updatedItem = await prisma.orderItem.update({
        where: { id: itemId },
        data: { itemStatus: 'fulfilled' },
        include: { order: { include: { orderItems: true } }, menuItem: true }
      });
      
      io.emit('item_fulfilled', updatedItem);
      
      // Auto-clear order if all items fulfilled
      const allFulfilled = updatedItem.order.orderItems.every(i => i.itemStatus === 'fulfilled');
      if (allFulfilled) {
        const completedOrder = await prisma.order.update({
          where: { id: updatedItem.orderId },
          data: { status: 'completed' },
          include: {
            orderItems: {
              include: { menuItem: true }
            }
          }
        });
        io.emit('order_completed', completedOrder);
      }
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
