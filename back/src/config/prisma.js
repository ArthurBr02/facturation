// Single shared Prisma client instance for the whole API process.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
