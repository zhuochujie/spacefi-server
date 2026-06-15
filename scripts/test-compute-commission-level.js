#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 30000);
const RUN_ID = Date.now().toString(36).toUpperCase();
const REF_PREFIX = `CL${RUN_ID}`;
const ADDRESS_BASE = BigInt(`0x${Buffer.from(RUN_ID).toString('hex')}`);

function makeAddress(index) {
  return `0x${(ADDRESS_BASE + BigInt(index))
    .toString(16)
    .slice(-40)
    .padStart(40, '0')}`;
}

function makeRefCode(caseIndex, userIndex) {
  return `${REF_PREFIX}${caseIndex.toString(36)}${userIndex.toString(36)}`
    .toUpperCase()
    .slice(0, 32);
}

async function request(method, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.success === false) {
      throw new Error(
        `${method} ${path} failed: ${response.status} ${JSON.stringify(payload)}`,
      );
    }

    return payload?.data ?? payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function createUser(caseIndex, userIndex, recommenderRefCode) {
  return request('POST', '/test/users', {
    address: makeAddress(caseIndex * 100 + userIndex),
    refCode: makeRefCode(caseIndex, userIndex),
    recommenderRefCode,
    balance: '0',
    usdtBalance: '0',
    nodeLevel: 0,
  });
}

async function addMiner(accountId, minerId) {
  return request('POST', `/test/users/${accountId}/miners`, { minerId });
}

async function loadTestMiners() {
  return request('GET', '/test/commission-level/miners');
}

async function computeCommissionLevel(accountId) {
  const result = await request(
    'GET',
    `/test/users/${accountId}/commission-level`,
  );
  return Number(result.commissionLevel);
}

async function runCase(testCase, caseIndex) {
  const root = await createUser(caseIndex, 0);

  for (const [index, minerId] of testCase.directMiners.entries()) {
    const directUser = await createUser(caseIndex, index + 1, root.refCode);
    await addMiner(directUser.id, minerId);
  }

  const actual = await computeCommissionLevel(root.id);
  const passed = actual === testCase.expected;

  console.log(
    `${passed ? 'PASS' : 'FAIL'} ${testCase.name}: expected=${testCase.expected}, actual=${actual}, accountId=${root.id}, miners=[${testCase.directMiners.join(',')}]`,
  );

  if (!passed) {
    throw new Error(
      `${testCase.name}: expected ${testCase.expected}, got ${actual}`,
    );
  }
}

async function main() {
  const miners = await loadTestMiners();
  const cases = [
    {
      name: '没有直推用户矿机',
      expected: 0,
      directMiners: [],
    },
    {
      name: '至少 1 台任意价格直推矿机',
      expected: 1,
      directMiners: [miners.lowMinerId],
    },
    {
      name: '至少 1 台中价值直推矿机',
      expected: 5,
      directMiners: [miners.midMinerId],
    },
    {
      name: '至少 1 台高价值直推矿机',
      expected: 10,
      directMiners: [miners.highMinerId],
    },
    {
      name: '至少 2 台高价值直推矿机',
      expected: 15,
      directMiners: [miners.highMinerId, miners.highMinerId],
    },
    {
      name: '至少 3 台高价值直推矿机',
      expected: 20,
      directMiners: [
        miners.highMinerId,
        miners.highMinerId,
        miners.highMinerId,
      ],
    },
  ];

  console.log(`baseUrl=${BASE_URL}`);
  console.log(
    `thresholds: mid=${miners.midThreshold}, high=${miners.highThreshold}; miners: low=${miners.lowMinerId}, mid=${miners.midMinerId}, high=${miners.highMinerId}`,
  );

  for (const [index, testCase] of cases.entries()) {
    await runCase(testCase, index + 1);
  }

  console.log(`done, passed=${cases.length}/${cases.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
