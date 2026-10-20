import { requiredEnv } from 'src/common/env.util';

export const buybackAddress = () =>
  requiredEnv('BUYBACK_CONTRACT_ADDRESS') as `0x${string}`;

export const buybackAbi = [
  {
    type: 'function',
    name: 'usedDepositNonces',
    stateMutability: 'view',
    inputs: [{ name: 'nonce', type: 'string' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'string' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;
