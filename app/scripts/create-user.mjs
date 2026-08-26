#!/usr/bin/env node
// Manual user creation -- deliberately no self-registration endpoint
// exists (this is an internal operator tool, not a public product).
// Run from app/: CREATE_USER_EMAIL=... CREATE_USER_PASSWORD=...
// CREATE_USER_NAME=... CREATE_USER_ROLE=ADMIN node scripts/create-user.mjs
//
// Requires DATABASE_URL in the environment (same as import:tracker).
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.ts";

const email = process.env.CREATE_USER_EMAIL;
const password = process.env.CREATE_USER_PASSWORD;
const name = process.env.CREATE_USER_NAME;
const role = process.env.CREATE_USER_ROLE ?? "OPERATOR";

if (!email || !password || !name) {
  console.error("Required: CREATE_USER_EMAIL, CREATE_USER_PASSWORD, CREATE_USER_NAME");
  console.error("Optional: CREATE_USER_ROLE (ADMIN | OPERATOR | REVIEWER | READ_ONLY, default OPERATOR)");
  process.exit(1);
}

const prisma = new PrismaClient();

const passwordHash = await hashPassword(password);
const user = await prisma.user.create({
  data: { email: email.trim().toLowerCase(), passwordHash, name, role },
});

console.log(`Created user ${user.email} (${user.role}), id ${user.id}`);

await prisma.$disconnect();
