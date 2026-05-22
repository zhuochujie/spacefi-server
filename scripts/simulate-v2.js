const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const ROOT_REF_CODE = process.env.ROOT_REF_CODE ?? 'WOCCY0RJ';
const SIGNATURE = process.env.SIGNATURE ?? 'test-signature';

const MINER = {
  id: 'SPACE_3000',
  price: '3000000000000000000000',
  payValue: '3000000000000000000000',
  expectedReward: '15000000000000000000000',
};

let sequence = Number(process.env.SEED ?? Date.now());

function nextHex(length) {
  sequence += 1;
  return sequence.toString(16).padStart(length, '0').slice(-length);
}

function nextAddress() {
  return `0x${nextHex(40)}`;
}

function nextTxHash() {
  return `0x${nextHex(64)}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || body?.success === false) {
    throw new Error(
      `${options.method ?? 'GET'} ${path} failed: ${JSON.stringify(body)}`,
    );
  }

  return body?.data ?? body;
}

async function register(address, refCode, label) {
  const result = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      address,
      refCode,
      signature: SIGNATURE,
    }),
  });

  const token = result.access_token;
  const profile = await request('/auth/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log(
    `[register] ${label}: address=${address}, refCode=${profile.refCode}`,
  );

  return {
    label,
    address,
    token,
    profile,
    refCode: profile.refCode,
  };
}

async function purchaseMiner(buyer, label) {
  const event = {
    transactionHash: nextTxHash(),
    logIndex: 0,
    buyer: buyer.address,
    minerId: MINER.id,
    price: MINER.price,
    payValue: MINER.payValue,
    expectedReward: MINER.expectedReward,
    nonce: `nonce-${nextHex(16)}`,
  };

  await request('/miner/test/purchase', {
    method: 'POST',
    body: JSON.stringify(event),
  });

  console.log(`[purchase] ${label}: buyer=${buyer.address}, miner=${MINER.id}`);
}

async function getProfile(account) {
  return request('/auth/profile', {
    headers: {
      Authorization: `Bearer ${account.token}`,
    },
  });
}

async function main() {
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`ROOT_REF_CODE=${ROOT_REF_CODE}`);

  const target = await register(nextAddress(), ROOT_REF_CODE, 'target-v2');
  const directBranches = [];

  for (let branchIndex = 1; branchIndex <= 3; branchIndex += 1) {
    const branch = await register(
      nextAddress(),
      target.refCode,
      `target-direct-${branchIndex}-will-be-v1`,
    );
    directBranches.push(branch);

    for (let leafIndex = 1; leafIndex <= 3; leafIndex += 1) {
      const leaf = await register(
        nextAddress(),
        branch.refCode,
        `branch-${branchIndex}-leaf-${leafIndex}`,
      );
      await purchaseMiner(leaf, `branch-${branchIndex}-leaf-${leafIndex}`);
    }

    const branchProfile = await getProfile(branch);
    console.log(
      `[profile] ${branch.label}: vipLevel=${branchProfile.vipLevel}`,
    );
  }

  const targetProfile = await getProfile(target);
  console.log(`[profile] target-v2: vipLevel=${targetProfile.vipLevel}`);
  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
