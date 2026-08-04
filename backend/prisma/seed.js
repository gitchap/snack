require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Create or update Admin user
  const pinHash = await bcrypt.hash('1234', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      pin: pinHash,
      role: 'admin',
    },
  });

  // Create or update Staff user
  const staffHash = await bcrypt.hash('0000', 10);
  await prisma.user.upsert({
    where: { username: 'staff' },
    update: {},
    create: {
      username: 'staff',
      pin: staffHash,
      role: 'staff',
    },
  });

  // Check if categories already exist to prevent duplicate seeding
  const existingCategories = await prisma.category.count();
  if (existingCategories > 0) {
    console.log('Database already seeded. Skipping...');
    return;
  }

  const catFood = await prisma.category.create({ data: { name: 'Hot Food' } });
  const catSnacks = await prisma.category.create({ data: { name: 'Snacks' } });
  const catDrinks = await prisma.category.create({ data: { name: 'Drinks' } });

  await prisma.menuItem.create({
    data: {
      name: 'Cheeseburger',
      price: 5.50,
      categoryId: catFood.id,
      options: {
        create: [
          { name: 'Cheese', choices: 'American,Cheddar,Swiss' },
          { name: 'Toppings', choices: 'Lettuce,Tomato,Onion,Pickles' }
        ]
      }
    }
  });

  await prisma.menuItem.create({
    data: {
      name: 'Hot Dog',
      price: 3.00,
      categoryId: catFood.id,
      options: {
        create: [
          { name: 'Condiments', choices: 'Ketchup,Mustard,Relish' }
        ]
      }
    }
  });

  await prisma.menuItem.create({
    data: {
      name: 'Chips',
      price: 1.50,
      categoryId: catSnacks.id,
      options: {
        create: [
          { name: 'Flavor', choices: 'Regular,BBQ,Sour Cream & Onion' }
        ]
      }
    }
  });

  await prisma.menuItem.create({
    data: {
      name: 'Soda',
      price: 2.00,
      categoryId: catDrinks.id,
      options: {
        create: [
          { name: 'Type', choices: 'Cola,Diet Cola,Lemon-Lime,Root Beer' }
        ]
      }
    }
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
