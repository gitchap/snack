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

// User Management APIs
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true }
  });
  res.json(users);
});

app.put('/api/admin/users/:id/pin', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { pin } = req.body;
  if (!pin || pin.trim().length === 0) return res.status(400).json({ error: 'PIN required' });
  
  const pinHash = await bcrypt.hash(pin, 10);
  await prisma.user.update({
    where: { id: parseInt(req.params.id) },
    data: { pin: pinHash }
  });
  res.json({ success: true });
});

// Admin REST API for Categories (Protected)
app.post('/api/admin/categories', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name required' });
    const category = await prisma.category.create({ data: { name: name.trim() } });
    io.emit('menu_updated');
    res.json(category);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/categories/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name required' });
    const category = await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: { name: name.trim() }
    });
    io.emit('menu_updated');
    res.json(category);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/categories/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const id = parseInt(req.params.id);
    const count = await prisma.menuItem.count({ where: { categoryId: id } });
    if (count > 0) return res.status(400).json({ error: 'Cannot delete category containing items' });
    await prisma.category.delete({ where: { id } });
    io.emit('menu_updated');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin REST API for Menu Items & Options (Protected)
app.post('/api/admin/menu', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const { name, categoryId } = req.body;
    const item = await prisma.menuItem.create({ data: { name, categoryId } });
    io.emit('menu_updated');
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/menu/:itemId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const itemId = parseInt(req.params.itemId);
    // Delete associated item options first
    await prisma.itemOption.deleteMany({ where: { menuItemId: itemId } });
    await prisma.menuItem.delete({ where: { id: itemId } });
    io.emit('menu_updated');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/menu/:itemId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const { name, categoryId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Item name is required' });
    if (!categoryId || isNaN(parseInt(categoryId))) return res.status(400).json({ error: 'Valid category is required' });

    const item = await prisma.menuItem.update({
      where: { id: parseInt(req.params.itemId) },
      data: { name: name.trim(), categoryId: parseInt(categoryId) },
      include: { options: true }
    });
    io.emit('menu_updated');
    res.json(item);
  } catch (e) {
    console.error('Error updating menu item:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/menu/:itemId/options', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const { name, choices, defaultOn } = req.body;
    if (!choices || !choices.trim()) return res.status(400).json({ error: 'Option choices are required' });

    const option = await prisma.itemOption.create({
      data: {
        menuItemId: parseInt(req.params.itemId),
        name: (name || 'Ingredients').trim(),
        choices: choices.trim(),
        defaultOn: defaultOn !== false
      }
    });
    io.emit('menu_updated');
    res.json(option);
  } catch (e) {
    console.error('Error creating option:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/options/:optionId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const { name, choices, defaultOn } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Option group name is required' });
    if (!choices || !choices.trim()) return res.status(400).json({ error: 'Option choices are required' });

    const option = await prisma.itemOption.update({
      where: { id: parseInt(req.params.optionId) },
      data: { name: name.trim(), choices: choices.trim(), defaultOn: defaultOn !== false }
    });
    io.emit('menu_updated');
    res.json(option);
  } catch (e) {
    console.error('Error updating option:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/options/:optionId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    await prisma.itemOption.delete({
      where: { id: parseInt(req.params.optionId) }
    });
    io.emit('menu_updated');
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting option:', e);
    res.status(500).json({ error: e.message });
  }
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
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' }
    ],
    include: {
      orderItems: {
        include: { menuItem: true }
      }
    }
  });
  res.json(orders);
});

// Get Order History (completed/cancelled orders or search)
app.get('/api/orders/history', async (req, res) => {
  try {
    const { search, limit } = req.query;
    const where = {
      status: { in: ['completed', 'cancelled'] }
    };
    if (search && search.trim()) {
      const q = search.trim();
      const num = parseInt(q);
      where.OR = [
        { customerName: { contains: q } },
        !isNaN(num) ? { orderNumber: num } : undefined
      ].filter(Boolean);
    }
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit) : 50,
      include: {
        orderItems: {
          include: { menuItem: true }
        }
      }
    });
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
          customerName: data.customerName || null,
          priority: Boolean(data.priority),
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
      if (status === 'ready') {
        await prisma.orderItem.updateMany({
          where: { orderId },
          data: { kitchenItemStatus: 'ready' }
        });
      }
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

  socket.on('toggle_kitchen_item', async ({ itemId }) => {
    try {
      const currentItem = await prisma.orderItem.findUnique({ where: { id: itemId } });
      if (!currentItem) return;
      const nextStatus = currentItem.kitchenItemStatus === 'ready' ? 'pending' : 'ready';

      const updatedItem = await prisma.orderItem.update({
        where: { id: itemId },
        data: { kitchenItemStatus: nextStatus },
        include: { order: { include: { orderItems: true } }, menuItem: true }
      });

      // Auto-set whole ticket to ready if all items are marked ready by kitchen
      const allKitchenReady = updatedItem.order.orderItems.every(i => i.kitchenItemStatus === 'ready');
      if (allKitchenReady && updatedItem.order.kitchenStatus !== 'ready') {
        const updatedOrder = await prisma.order.update({
          where: { id: updatedItem.orderId },
          data: { kitchenStatus: 'ready' },
          include: {
            orderItems: { include: { menuItem: true } }
          }
        });
        io.emit('order_updated', updatedOrder);
      } else {
        const fullOrder = await prisma.order.findUnique({
          where: { id: updatedItem.orderId },
          include: { orderItems: { include: { menuItem: true } } }
        });
        io.emit('order_updated', fullOrder);
      }
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

  socket.on('recall_order', async ({ orderId }) => {
    try {
      await prisma.order.update({
        where: { id: parseInt(orderId) },
        data: { 
          status: 'active',
          kitchenStatus: 'pending'
        }
      });

      await prisma.orderItem.updateMany({
        where: { orderId: parseInt(orderId) },
        data: { 
          itemStatus: 'pending',
          kitchenItemStatus: 'pending'
        }
      });

      const recalledOrder = await prisma.order.findUnique({
        where: { id: parseInt(orderId) },
        include: {
          orderItems: {
            include: { menuItem: true }
          }
        }
      });

      io.emit('new_order', recalledOrder);
      io.emit('order_recalled', recalledOrder);
    } catch (e) {
      console.error('Error recalling order:', e);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
