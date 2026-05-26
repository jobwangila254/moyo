const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function safeJsonParse(val, fallback = []) {
  if (!val || val === '[]') return fallback;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

module.exports = { prisma, safeJsonParse };
