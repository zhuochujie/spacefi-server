#!/usr/bin/env node

const fs = require('fs');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const ROOT_REF_CODE = process.env.ROOT_REF_CODE ?? 'SQ3P5WDB';
const DEPTH = Number(process.env.DEPTH ?? 11);
const BRANCH = Number(process.env.BRANCH ?? 3);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 10);
const MAX_USERS = Number(process.env.MAX_USERS ?? 120000);
const ADDRESS_OFFSET = BigInt(process.env.ADDRESS_OFFSET ?? '1000000');
const OUTPUT = process.env.OUTPUT ?? 'tmp/test-users.json';

function makeAddress(index) {
  return `0x${(ADDRESS_OFFSET + BigInt(index)).toString(16).padStart(40, '0')}`;
}

function makeRefCode(index) {
  return `T${index.toString(36).toUpperCase().padStart(7, '0')}`.slice(0, 8);
}

async function request(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload?.data ?? payload;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await fn(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

async function createUser(userIndex, recommenderRefCode, level) {
  const account = await request('/test/users', {
    address: makeAddress(userIndex),
    recommenderRefCode,
    refCode: makeRefCode(userIndex),
    balance: '0',
    usdtBalance: '0',
    nodeLevel: 0,
  });

  return {
    id: account.id,
    address: account.address,
    refCode: account.refCode,
    recommenderRefCode,
    level,
    userIndex,
  };
}

function validatePositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function calculateTotalUsers(depth, branch) {
  let total = 0;
  let levelCount = 1;

  for (let level = 1; level <= depth; level += 1) {
    levelCount *= branch;
    total += levelCount;
  }

  return total;
}

async function main() {
  validatePositiveInteger('DEPTH', DEPTH);
  validatePositiveInteger('BRANCH', BRANCH);
  validatePositiveInteger('CONCURRENCY', CONCURRENCY);
  validatePositiveInteger('MAX_USERS', MAX_USERS);

  const plannedUsers = calculateTotalUsers(DEPTH, BRANCH);

  let nextUserIndex = 1;
  let parents = [{ refCode: ROOT_REF_CODE }];
  const users = [];

  console.log(`baseUrl=${BASE_URL}`);
  console.log(`rootRefCode=${ROOT_REF_CODE}, depth=${DEPTH}, branch=${BRANCH}, plannedUsers=${plannedUsers}, maxUsers=${MAX_USERS}, concurrency=${CONCURRENCY}`);
  console.log(`output=${OUTPUT}`);

  for (let level = 1; level <= DEPTH; level += 1) {
    const tasks = [];
    for (const parent of parents) {
      for (let i = 0; i < BRANCH; i += 1) {
        if (users.length + tasks.length >= MAX_USERS) {
          break;
        }
        const userIndex = nextUserIndex;
        nextUserIndex += 1;
        tasks.push({
          userIndex,
          recommenderRefCode: parent.refCode,
        });
      }
      if (users.length + tasks.length >= MAX_USERS) {
        break;
      }
    }

    if (tasks.length === 0) {
      console.log(`maxUsers reached before level ${level}, totalCreated=${users.length}`);
      break;
    }

    console.log(`level ${level}: creating ${tasks.length} users`);
    const created = await mapLimit(tasks, CONCURRENCY, (task) =>
      createUser(task.userIndex, task.recommenderRefCode, level),
    );

    users.push(...created);
    parents = created;
    console.log(`level ${level} done, totalCreated=${users.length}`);

    if (users.length >= MAX_USERS) {
      console.log(`maxUsers reached at level ${level}, totalCreated=${users.length}`);
      break;
    }
  }

  fs.mkdirSync(require('path').dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(
    OUTPUT,
    JSON.stringify({
      baseUrl: BASE_URL,
      rootRefCode: ROOT_REF_CODE,
      depth: DEPTH,
      branch: BRANCH,
      plannedUsers,
      maxUsers: MAX_USERS,
      createdAt: Math.floor(Date.now() / 1000),
      users,
    }, null, 2),
  );

  console.log(`done, totalCreated=${users.length}, output=${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
