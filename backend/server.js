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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
  try {
    const { username, pin } = req.body;
    if (!username || !pin) return res.status(400).json({ error: 'Username and PIN required' });
    
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(pin, user.pin);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    // Indefinite session: stay signed in permanently until explicit logout
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '36500d' });
    res.json({ token, role: user.role });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User Management APIs
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (e) {
    console.error('Fetch users error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const ADMIN_MASTER_PASSWORD = process.env.ADMIN_MASTER_PASSWORD || 'snackmaster123';

app.put('/api/admin/users/:id/pin', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const { pin, masterPassword } = req.body;
    if (!pin || pin.trim().length === 0) return res.status(400).json({ error: 'New PIN is required' });
    
    if (!masterPassword || masterPassword !== ADMIN_MASTER_PASSWORD) {
      return res.status(403).json({ error: 'Invalid Master Admin Password. PIN change denied.' });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { pin: pinHash }
    });
    res.json({ success: true, message: 'PIN updated successfully' });
  } catch (e) {
    console.error('Update PIN error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Database Management APIs (Backup, Export & Import) ---

app.get('/api/admin/database/stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const [categoryCount, menuItemCount, itemOptionCount, userCount, activeOrdersCount, historyOrdersCount] = await Promise.all([
      prisma.category.count(),
      prisma.menuItem.count(),
      prisma.itemOption.count(),
      prisma.user.count(),
      prisma.order.count({ where: { status: 'active' } }),
      prisma.order.count({ where: { status: { in: ['completed', 'cancelled'] } } })
    ]);
    res.json({
      categoryCount,
      menuItemCount,
      itemOptionCount,
      userCount,
      activeOrdersCount,
      historyOrdersCount,
      totalOrdersCount: activeOrdersCount + historyOrdersCount
    });
  } catch (e) {
    console.error('Database stats error:', e);
    res.status(500).json({ error: 'Failed to fetch database statistics' });
  }
});

app.get('/api/admin/database/export', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const mode = req.query.mode === 'full' ? 'full' : 'menu';
    const includeUsers = req.query.includeUsers !== 'false';

    const categories = await prisma.category.findMany({
      include: {
        menuItems: {
          include: {
            options: true
          }
        }
      }
    });

    let users = [];
    if (includeUsers) {
      users = await prisma.user.findMany({
        select: {
          username: true,
          pin: true,
          role: true,
          createdAt: true
        }
      });
    }

    let orders = [];
    if (mode === 'full') {
      orders = await prisma.order.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          orderItems: {
            include: {
              menuItem: true
            }
          }
        }
      });
    }

    const totalMenuItems = categories.reduce((sum, c) => sum + (c.menuItems?.length || 0), 0);
    const totalOptions = categories.reduce((sum, c) => sum + (c.menuItems || []).reduce((s, m) => s + (m.options?.length || 0), 0), 0);

    const payload = {
      version: '1.0',
      app: 'snack-shack',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.username,
      mode,
      summary: {
        categories: categories.length,
        menuItems: totalMenuItems,
        itemOptions: totalOptions,
        users: users.length,
        orders: orders.length
      },
      data: {
        categories,
        users,
        orders
      }
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="snack-shack-${mode}-${dateStr}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error('Database export error:', e);
    res.status(500).json({ error: 'Failed to export database' });
  }
});

app.post('/api/admin/database/import', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const { payload, mode = 'merge', importOrders = false, importUsers = true } = req.body;

    if (!payload || !payload.data || !Array.isArray(payload.data.categories)) {
      return res.status(400).json({ error: 'Invalid backup file format. Missing data.categories array.' });
    }

    const { categories = [], users = [], orders = [] } = payload.data;

    let importedCounts = {
      categories: 0,
      menuItems: 0,
      options: 0,
      users: 0,
      orders: 0
    };

    await prisma.$transaction(async (tx) => {
      if (mode === 'replace') {
        // Clear existing tables in dependency order
        await tx.orderItem.deleteMany();
        await tx.order.deleteMany();
        await tx.itemOption.deleteMany();
        await tx.menuItem.deleteMany();
        await tx.category.deleteMany();

        // Import users if requested
        if (importUsers && Array.isArray(users) && users.length > 0) {
          for (const u of users) {
            if (u.username && u.pin) {
              await tx.user.upsert({
                where: { username: u.username },
                update: { pin: u.pin, role: u.role || 'staff' },
                create: { username: u.username, pin: u.pin, role: u.role || 'staff' }
              });
              importedCounts.users++;
            }
          }
        }

        const menuItemIdMap = new Map();

        // Create categories, items, options
        for (const cat of categories) {
          if (!cat.name) continue;
          const createdCat = await tx.category.create({
            data: { name: cat.name }
          });
          importedCounts.categories++;

          for (const item of (cat.menuItems || [])) {
            if (!item.name) continue;
            const createdItem = await tx.menuItem.create({
              data: {
                name: item.name,
                price: typeof item.price !== 'undefined' ? parseFloat(item.price) || 0.0 : 0.0,
                requiresCooking: item.requiresCooking !== false,
                categoryId: createdCat.id
              }
            });
            menuItemIdMap.set(item.id, createdItem.id);
            importedCounts.menuItems++;

            for (const opt of (item.options || [])) {
              if (!opt.choices) continue;
              await tx.itemOption.create({
                data: {
                  menuItemId: createdItem.id,
                  name: (opt.name || 'Ingredients').trim(),
                  choices: opt.choices.trim(),
                  defaultOn: opt.defaultOn !== false,
                  required: opt.required === true
                }
              });
              importedCounts.options++;
            }
          }
        }

        // Import orders if requested
        if (importOrders && Array.isArray(orders) && orders.length > 0) {
          for (const ord of orders) {
            const createdOrder = await tx.order.create({
              data: {
                orderNumber: ord.orderNumber || 1,
                customerName: ord.customerName || null,
                priority: Boolean(ord.priority),
                status: ord.status || 'completed',
                kitchenStatus: ord.kitchenStatus || 'ready',
                createdAt: ord.createdAt ? new Date(ord.createdAt) : new Date()
              }
            });
            importedCounts.orders++;

            for (const ordItem of (ord.orderItems || [])) {
              const mappedItemId = menuItemIdMap.get(ordItem.menuItemId) || (ordItem.menuItem ? Array.from(menuItemIdMap.values())[0] : null);
              if (mappedItemId) {
                await tx.orderItem.create({
                  data: {
                    orderId: createdOrder.id,
                    menuItemId: mappedItemId,
                    quantity: ordItem.quantity || 1,
                    itemStatus: ordItem.itemStatus || 'fulfilled',
                    kitchenItemStatus: ordItem.kitchenItemStatus || 'ready',
                    optionsSnapshot: typeof ordItem.optionsSnapshot === 'string' ? ordItem.optionsSnapshot : JSON.stringify(ordItem.optionsSnapshot || {})
                  }
                });
              }
            }
          }
        }
      } else {
        // Mode: 'merge'
        const menuItemIdMap = new Map();

        // Merge Categories and Menu Items
        for (const cat of categories) {
          if (!cat.name) continue;
          let targetCat = await tx.category.findFirst({ where: { name: cat.name.trim() } });
          if (!targetCat) {
            targetCat = await tx.category.create({ data: { name: cat.name.trim() } });
            importedCounts.categories++;
          }

          for (const item of (cat.menuItems || [])) {
            if (!item.name) continue;
            let targetItem = await tx.menuItem.findFirst({
              where: { name: item.name.trim(), categoryId: targetCat.id }
            });
            if (!targetItem) {
              targetItem = await tx.menuItem.create({
                data: {
                  name: item.name.trim(),
                  price: typeof item.price !== 'undefined' ? parseFloat(item.price) || 0.0 : 0.0,
                  requiresCooking: item.requiresCooking !== false,
                  categoryId: targetCat.id
                }
              });
              importedCounts.menuItems++;
            }
            menuItemIdMap.set(item.id, targetItem.id);

            for (const opt of (item.options || [])) {
              if (!opt.choices) continue;
              const optName = (opt.name || 'Ingredients').trim();
              const existingOpt = await tx.itemOption.findFirst({
                where: { menuItemId: targetItem.id, name: optName }
              });
              if (!existingOpt) {
                await tx.itemOption.create({
                  data: {
                    menuItemId: targetItem.id,
                    name: optName,
                    choices: opt.choices.trim(),
                    defaultOn: opt.defaultOn !== false,
                    required: opt.required === true
                  }
                });
                importedCounts.options++;
              }
            }
          }
        }

        // Merge Users
        if (importUsers && Array.isArray(users) && users.length > 0) {
          for (const u of users) {
            if (u.username && u.pin) {
              const existingUser = await tx.user.findUnique({ where: { username: u.username } });
              if (!existingUser) {
                await tx.user.create({
                  data: { username: u.username, pin: u.pin, role: u.role || 'staff' }
                });
                importedCounts.users++;
              }
            }
          }
        }

        // Merge Orders
        if (importOrders && Array.isArray(orders) && orders.length > 0) {
          for (const ord of orders) {
            const createdOrder = await tx.order.create({
              data: {
                orderNumber: ord.orderNumber || 1,
                customerName: ord.customerName || null,
                priority: Boolean(ord.priority),
                status: ord.status || 'completed',
                kitchenStatus: ord.kitchenStatus || 'ready',
                createdAt: ord.createdAt ? new Date(ord.createdAt) : new Date()
              }
            });
            importedCounts.orders++;

            for (const ordItem of (ord.orderItems || [])) {
              const mappedItemId = menuItemIdMap.get(ordItem.menuItemId);
              if (mappedItemId) {
                await tx.orderItem.create({
                  data: {
                    orderId: createdOrder.id,
                    menuItemId: mappedItemId,
                    quantity: ordItem.quantity || 1,
                    itemStatus: ordItem.itemStatus || 'fulfilled',
                    kitchenItemStatus: ordItem.kitchenItemStatus || 'ready',
                    optionsSnapshot: typeof ordItem.optionsSnapshot === 'string' ? ordItem.optionsSnapshot : JSON.stringify(ordItem.optionsSnapshot || {})
                  }
                });
              }
            }
          }
        }
      }
    });

    io.emit('menu_updated');
    if (importOrders || mode === 'replace') {
      io.emit('order_updated');
    }

    res.json({
      success: true,
      message: `Database successfully ${mode === 'replace' ? 'restored' : 'merged'}!`,
      counts: importedCounts
    });
  } catch (e) {
    console.error('Database import error:', e);
    res.status(500).json({ error: e.message || 'Failed to import database' });
  }
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
    const { name, price, categoryId, requiresCooking } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Item name is required' });
    if (!categoryId || isNaN(parseInt(categoryId))) return res.status(400).json({ error: 'Valid category is required' });

    const item = await prisma.menuItem.create({
      data: {
        name: name.trim(),
        price: typeof price !== 'undefined' ? parseFloat(price) || 0.0 : 0.0,
        categoryId: parseInt(categoryId),
        requiresCooking: requiresCooking !== false
      }
    });
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
    const { name, price, categoryId, requiresCooking } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Item name is required' });
    if (!categoryId || isNaN(parseInt(categoryId))) return res.status(400).json({ error: 'Valid category is required' });

    const data = { name: name.trim(), categoryId: parseInt(categoryId) };
    if (typeof price !== 'undefined') {
      data.price = parseFloat(price) || 0.0;
    }
    if (typeof requiresCooking === 'boolean') {
      data.requiresCooking = requiresCooking;
    }

    const item = await prisma.menuItem.update({
      where: { id: parseInt(req.params.itemId) },
      data,
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
    const { name, choices, defaultOn, required } = req.body;
    if (!choices || !choices.trim()) return res.status(400).json({ error: 'Option choices are required' });

    const option = await prisma.itemOption.create({
      data: {
        menuItemId: parseInt(req.params.itemId),
        name: (name || 'Ingredients').trim(),
        choices: choices.trim(),
        defaultOn: defaultOn !== false,
        required: required === true
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
    const { name, choices, defaultOn, required } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Option group name is required' });
    if (!choices || !choices.trim()) return res.status(400).json({ error: 'Option choices are required' });

    const option = await prisma.itemOption.update({
      where: { id: parseInt(req.params.optionId) },
      data: {
        name: name.trim(),
        choices: choices.trim(),
        defaultOn: defaultOn !== false,
        required: required === true
      }
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
  try {
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
  } catch (e) {
    console.error('Fetch menu error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Active Orders
app.get('/api/orders/active', async (req, res) => {
  try {
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
  } catch (e) {
    console.error('Fetch active orders error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
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

      // Check requiresCooking for all items in order
      const itemIds = (data.items || []).map(i => i.menuItemId);
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: itemIds } }
      });
      const menuItemMap = new Map(menuItems.map(m => [m.id, m]));

      const orderItemsCreate = (data.items || []).map(item => {
        const mi = menuItemMap.get(item.menuItemId);
        const needsCooking = mi ? mi.requiresCooking !== false : true;
        return {
          menuItemId: item.menuItemId,
          quantity: item.quantity || 1,
          itemStatus: 'pending',
          kitchenItemStatus: needsCooking ? 'pending' : 'ready',
          optionsSnapshot: JSON.stringify(item.optionsSnapshot || {})
        };
      });

      const anyCookingNeeded = orderItemsCreate.some(i => i.kitchenItemStatus === 'pending');
      const initialKitchenStatus = anyCookingNeeded ? 'pending' : 'ready';

      const newOrder = await prisma.order.create({
        data: {
          orderNumber,
          customerName: data.customerName || null,
          priority: Boolean(data.priority),
          kitchenStatus: initialKitchenStatus,
          orderItems: {
            create: orderItemsCreate
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
        data: { itemStatus: 'fulfilled', kitchenItemStatus: 'ready' },
        include: { order: { include: { orderItems: true } }, menuItem: true }
      });
      
      io.emit('item_fulfilled', updatedItem);
      
      // Check if all kitchen items in order are ready
      const allKitchenReady = updatedItem.order.orderItems.every(i => i.kitchenItemStatus === 'ready' || i.id === itemId);
      if (allKitchenReady && updatedItem.order.kitchenStatus !== 'ready') {
        await prisma.order.update({
          where: { id: updatedItem.orderId },
          data: { kitchenStatus: 'ready' }
        });
      }

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

  socket.on('unfulfill_item', async ({ itemId }) => {
    try {
      const currentItem = await prisma.orderItem.findUnique({
        where: { id: itemId },
        include: { order: true }
      });
      if (!currentItem) return;

      const updatedItem = await prisma.orderItem.update({
        where: { id: itemId },
        data: { itemStatus: 'pending' },
        include: { order: { include: { orderItems: true } }, menuItem: true }
      });

      // If order was completed, revert order status back to active
      if (currentItem.order.status === 'completed') {
        const restoredOrder = await prisma.order.update({
          where: { id: currentItem.orderId },
          data: { status: 'active' },
          include: {
            orderItems: { include: { menuItem: true } }
          }
        });
        io.emit('new_order', restoredOrder);
        io.emit('order_updated', restoredOrder);
      } else {
        io.emit('item_unfulfilled', updatedItem);
        const fullOrder = await prisma.order.findUnique({
          where: { id: updatedItem.orderId },
          include: { orderItems: { include: { menuItem: true } } }
        });
        io.emit('order_updated', fullOrder);
      }
    } catch (e) {
      console.error('Error unfulfilling item:', e);
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
