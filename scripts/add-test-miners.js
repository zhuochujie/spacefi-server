#!/usr/bin/env node

const fs = require('fs');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const INPUT = process.env.INPUT ?? 'tmp/test-users.json';
const MINER_ID = process.env.MINER_ID ?? 'SPACE_5000';
const PROGRESS = process.env.PROGRESS ?? `${INPUT}.${MINER_ID}.progress.json`;
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 30000);
const REQUEST_RETRIES = Number(process.env.REQUEST_RETRIES ?? 3);
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS ?? 1000);
const LOG_EVERY = Number(process.env.LOG_EVERY ?? 10);
const SAVE_EVERY = Number(process.env.SAVE_EVERY ?? 20);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatRequestError(error, path, attempt, durationMs) {
  if (error?.name === 'AbortError') {
    return new Error(`${path} timed out after ${durationMs}ms, attempt=${attempt}/${REQUEST_RETRIES + 1}`);
  }

  if (error instanceof Error) {
    return new Error(`${path} failed after ${durationMs}ms, attempt=${attempt}/${REQUEST_RETRIES + 1}: ${error.message}`);
  }

  return new Error(`${path} failed after ${durationMs}ms, attempt=${attempt}/${REQUEST_RETRIES + 1}: ${String(error)}`);
}

async function requestOnce(path, body, attempt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  let response;
  let payload;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    payload = await response.json().catch(() => null);
  } catch (error) {
    throw formatRequestError(error, path, attempt, Date.now() - startedAt);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok || payload?.success === false) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload?.data ?? payload;
}

async function request(path, body) {
  let lastError;

  for (let attempt = 1; attempt <= REQUEST_RETRIES + 1; attempt += 1) {
    try {
      return await requestOnce(path, body, attempt);
    } catch (error) {
      lastError = error;

      if (attempt > REQUEST_RETRIES) {
        break;
      }

      const delayMs = RETRY_DELAY_MS * attempt;
      console.warn(`${error.message}; retrying in ${delayMs}ms`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function loadProgress(path) {
  if (!fs.existsSync(path)) {
    return new Set();
  }

  const progress = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!Array.isArray(progress.completedUserIds)) {
    throw new Error(`invalid progress file: ${path}`);
  }

  return new Set(progress.completedUserIds.map(String));
}

function saveProgress(path, completedUserIds) {
  fs.mkdirSync(require('path').dirname(path), { recursive: true });
  const tempPath = `${path}.tmp`;
  fs.writeFileSync(
    tempPath,
    JSON.stringify({
      input: INPUT,
      minerId: MINER_ID,
      updatedAt: Math.floor(Date.now() / 1000),
      completedCount: completedUserIds.size,
      completedUserIds: [...completedUserIds],
    }, null, 2),
  );
  fs.renameSync(tempPath, path);
}

function validatePositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function validateNonNegativeInteger(name, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

async function main() {
  validatePositiveInteger('REQUEST_TIMEOUT_MS', REQUEST_TIMEOUT_MS);
  validateNonNegativeInteger('REQUEST_RETRIES', REQUEST_RETRIES);
  validatePositiveInteger('RETRY_DELAY_MS', RETRY_DELAY_MS);
  validatePositiveInteger('LOG_EVERY', LOG_EVERY);
  validatePositiveInteger('SAVE_EVERY', SAVE_EVERY);

  const input = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  const users = input.users;
  if (!Array.isArray(users)) {
    throw new Error(`invalid input file: ${INPUT}`);
  }
  const completedUserIds = loadProgress(PROGRESS);
  const pendingUsers = users.filter(user => !completedUserIds.has(String(user.id)));

  console.log(`baseUrl=${BASE_URL}`);
  console.log(`input=${INPUT}, users=${users.length}, minerId=${MINER_ID}, mode=sequential, requestTimeoutMs=${REQUEST_TIMEOUT_MS}, requestRetries=${REQUEST_RETRIES}`);
  console.log(`progress=${PROGRESS}, completed=${completedUserIds.size}, pending=${pendingUsers.length}`);
  let completedSinceSave = 0;

  for (const [index, user] of pendingUsers.entries()) {
    if (index === 0 || (index + 1) % LOG_EVERY === 0) {
      console.log(`starting ${index + 1}/${pendingUsers.length}, accountId=${user.id}`);
    }

    try {
      await request(`/test/users/${user.id}/miners`, {
        minerId: MINER_ID,
      });
    } catch (error) {
      saveProgress(PROGRESS, completedUserIds);
      throw new Error(`failed at ${index + 1}/${pendingUsers.length}, accountId=${user.id}: ${error.message}`);
    }

    completedUserIds.add(String(user.id));
    completedSinceSave += 1;

    if (completedSinceSave >= SAVE_EVERY || index + 1 === pendingUsers.length) {
      saveProgress(PROGRESS, completedUserIds);
      completedSinceSave = 0;
    }

    if ((index + 1) % LOG_EVERY === 0 || index + 1 === pendingUsers.length) {
      console.log(`completed ${completedUserIds.size}/${users.length}, pending=${users.length - completedUserIds.size}`);
    }
  }

  saveProgress(PROGRESS, completedUserIds);
  console.log(`done, minerId=${MINER_ID}, users=${users.length}, progress=${PROGRESS}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
