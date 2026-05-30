import type { Abi } from 'viem';
import { requiredEnv } from 'src/common/env.util';

export const signerPrivateKey = requiredEnv('SIGNER_PRIVATE_KEY') as `0x${string}`;

export const marketAbi = [
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "spaceTokenAddr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "usdtTokenAddr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "nodeFeeReceiverAddr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "markerFeeReceiverAddr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "minPrice_",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "maxPrice_",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "minOrderSpaceAmount_",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nodeFeeBps_",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "markerFeeBps_",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "signerAddr",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "BPS_DENOMINATOR",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "PRICE_PRECISION",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "SPACE_TOKEN",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "contract IERC20"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "USDT_TOKEN",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "contract IERC20"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "cancelOrder",
        "inputs": [
            {
                "name": "orderId",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "feeExemptAccounts",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "exempt",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "feeExemptNonces",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "nonce",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "feeExemptSpaceQuotas",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "quota",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "fillOrder",
        "inputs": [
            {
                "name": "orderId",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "spaceAmount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "orderIdSource",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getFeeExemptDigest",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "exempt",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getOrder",
        "inputs": [
            {
                "name": "orderId",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "internalType": "struct TokenExchange.Order",
                "components": [
                    {
                        "name": "id",
                        "type": "bytes32",
                        "internalType": "bytes32"
                    },
                    {
                        "name": "maker",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "side",
                        "type": "uint8",
                        "internalType": "enum TokenExchange.OrderSide"
                    },
                    {
                        "name": "spaceAmount",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "remainingSpaceAmount",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "price",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "status",
                        "type": "uint8",
                        "internalType": "enum TokenExchange.OrderStatus"
                    },
                    {
                        "name": "visible",
                        "type": "bool",
                        "internalType": "bool"
                    },
                    {
                        "name": "createdAt",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getOrderId",
        "inputs": [
            {
                "name": "orderIdSource",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "markerFeeBps",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "markerFeeReceiver",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "maxPrice",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "minOrderSpaceAmount",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "minPrice",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "nodeFeeBps",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "nodeFeeReceiver",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "orders",
        "inputs": [
            {
                "name": "orderId",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "id",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "maker",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "side",
                "type": "uint8",
                "internalType": "enum TokenExchange.OrderSide"
            },
            {
                "name": "spaceAmount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "remainingSpaceAmount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "price",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "status",
                "type": "uint8",
                "internalType": "enum TokenExchange.OrderStatus"
            },
            {
                "name": "visible",
                "type": "bool",
                "internalType": "bool"
            },
            {
                "name": "createdAt",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "placeBuyOrder",
        "inputs": [
            {
                "name": "orderId",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "spaceAmount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "price",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "visible",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "placeSellOrder",
        "inputs": [
            {
                "name": "orderId",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "spaceAmount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "price",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "visible",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "quoteFee",
        "inputs": [
            {
                "name": "usdtAmount",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "nodeFee",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "markerFee",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "quoteUsdtAmount",
        "inputs": [
            {
                "name": "spaceAmount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "price",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "renounceOwnership",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setFeeBps",
        "inputs": [
            {
                "name": "nodeFeeBps_",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "markerFeeBps_",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setFeeExempt",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "exempt",
                "type": "bool",
                "internalType": "bool"
            },
            {
                "name": "signature",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setFeeReceivers",
        "inputs": [
            {
                "name": "nodeFeeReceiver_",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "markerFeeReceiver_",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setMinOrderSpaceAmount",
        "inputs": [
            {
                "name": "minOrderSpaceAmount_",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setPriceRange",
        "inputs": [
            {
                "name": "minPrice_",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "maxPrice_",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setSigner",
        "inputs": [
            {
                "name": "signer_",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "signer",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "transferOwnership",
        "inputs": [
            {
                "name": "newOwner",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "FeeBpsUpdated",
        "inputs": [
            {
                "name": "nodeFeeBps",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "markerFeeBps",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "FeeExemptQuotaIncreased",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "amount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "newQuota",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "FeeExemptQuotaUsed",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "amount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "remainingQuota",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "FeeExemptUpdated",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "exempt",
                "type": "bool",
                "indexed": false,
                "internalType": "bool"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "FeeReceiversUpdated",
        "inputs": [
            {
                "name": "nodeFeeReceiver",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "markerFeeReceiver",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "MinOrderSpaceAmountUpdated",
        "inputs": [
            {
                "name": "minOrderSpaceAmount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OrderCancelled",
        "inputs": [
            {
                "name": "orderId",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "maker",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OrderFilled",
        "inputs": [
            {
                "name": "orderId",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "maker",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "taker",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "spaceAmount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "price",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "usdtAmount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "nodeFee",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "markerFee",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OrderPlaced",
        "inputs": [
            {
                "name": "orderId",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "maker",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "side",
                "type": "uint8",
                "indexed": false,
                "internalType": "enum TokenExchange.OrderSide"
            },
            {
                "name": "spaceAmount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "price",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "usdtAmount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "visible",
                "type": "bool",
                "indexed": false,
                "internalType": "bool"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OwnershipTransferred",
        "inputs": [
            {
                "name": "previousOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "PriceRangeUpdated",
        "inputs": [
            {
                "name": "minPrice",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "maxPrice",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "SignerUpdated",
        "inputs": [
            {
                "name": "oldSigner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newSigner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "ECDSAInvalidSignature",
        "inputs": []
    },
    {
        "type": "error",
        "name": "ECDSAInvalidSignatureLength",
        "inputs": [
            {
                "name": "length",
                "type": "uint256",
                "internalType": "uint256"
            }
        ]
    },
    {
        "type": "error",
        "name": "ECDSAInvalidSignatureS",
        "inputs": [
            {
                "name": "s",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ]
    },
    {
        "type": "error",
        "name": "InvalidAddress",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidAmount",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidFeeBps",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidOrderId",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidOrderStatus",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidPriceRange",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidSignature",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidSigner",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotOrderMaker",
        "inputs": []
    },
    {
        "type": "error",
        "name": "OrderAlreadyExists",
        "inputs": []
    },
    {
        "type": "error",
        "name": "OwnableInvalidOwner",
        "inputs": [
            {
                "name": "owner",
                "type": "address",
                "internalType": "address"
            }
        ]
    },
    {
        "type": "error",
        "name": "OwnableUnauthorizedAccount",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            }
        ]
    },
    {
        "type": "error",
        "name": "PriceOutOfRange",
        "inputs": []
    },
    {
        "type": "error",
        "name": "ReentrancyGuardReentrantCall",
        "inputs": []
    },
    {
        "type": "error",
        "name": "SafeERC20FailedOperation",
        "inputs": [
            {
                "name": "token",
                "type": "address",
                "internalType": "address"
            }
        ]
    }
] as const satisfies Abi;

export const market = {
    address: requiredEnv('MARKET_CONTRACT_ADDRESS') as `0x${string}`,
    abi: marketAbi,
} as const;


export const miningAbi = [
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "tokenAddr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "usdtTokenAddr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "vaultAddr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "signerAddr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "vipFeeReceiverAddr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "nodeFeeReceiverAddr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "usdtFeeReceiverAddr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "usdtPurchaseSpaceLimit_",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "freeMinerSpaceAmount_",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "claim",
        "inputs": [
            {
                "name": "amount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "vipFee",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nodeFee",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "deadline",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "signature",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "claimFreeMiner",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "claimedFreeMiners",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "claimed",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "dividend",
        "inputs": [
            {
                "name": "vipFeeVaultSpaceAmount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nodeFeeVaultSpaceAmount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nodeFeeVaultUsdtAmountToMiner",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nodeFeeVaultUsdtAmountToUsdtFeeReceiver",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "freeMinerClaimEnabled",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "freeMinerSpaceAmount",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getClaimDigest",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "amount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "vipFee",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nodeFee",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "deadline",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getPurchaseMinerDigest",
        "inputs": [
            {
                "name": "buyer",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "minerId",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "price",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "payValue",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "expectedReward",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "paymentToken",
                "type": "uint8",
                "internalType": "enum Mining.PaymentToken"
            },
            {
                "name": "nonce",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "deadline",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getWithdrawUsdtDigest",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "amount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "deadline",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "nodeFeeReceiver",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "purchaseMiner",
        "inputs": [
            {
                "name": "minerId",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "price",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "payValue",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "expectedReward",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "paymentToken",
                "type": "uint8",
                "internalType": "enum Mining.PaymentToken"
            },
            {
                "name": "nonce",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "deadline",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "signature",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "renounceOwnership",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setFeeReceivers",
        "inputs": [
            {
                "name": "newVipFeeReceiver",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "newNodeFeeReceiver",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setFreeMinerClaimEnabled",
        "inputs": [
            {
                "name": "enabled",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setSigner",
        "inputs": [
            {
                "name": "newSigner",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setUsdtFeeReceiver",
        "inputs": [
            {
                "name": "newUsdtFeeReceiver",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "signer",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "spaceToken",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "contract IERC20"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "transferOwnership",
        "inputs": [
            {
                "name": "newOwner",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "usdtFeeReceiver",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "usdtPurchaseSpaceLimit",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "usdtPurchasedSpaceAmount",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "usdtToken",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "contract IERC20"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "usedClaimNonces",
        "inputs": [
            {
                "name": "nonce",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [
            {
                "name": "used",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "usedPurchaseNonces",
        "inputs": [
            {
                "name": "nonce",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [
            {
                "name": "used",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "usedWithdrawUsdtNonces",
        "inputs": [
            {
                "name": "nonce",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [
            {
                "name": "used",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "vault",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "vipFeeReceiver",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "withdrawUsdt",
        "inputs": [
            {
                "name": "amount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "deadline",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "signature",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "DividendDistributed",
        "inputs": [
            {
                "name": "vipFeeVaultSpaceAmount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "nodeFeeVaultSpaceAmount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "nodeFeeVaultUsdtAmountToMiner",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "nodeFeeVaultUsdtAmountToUsdtFeeReceiver",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "FeeReceiversUpdated",
        "inputs": [
            {
                "name": "oldVipFeeReceiver",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newVipFeeReceiver",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "oldNodeFeeReceiver",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newNodeFeeReceiver",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "FreeMinerClaimEnabledUpdated",
        "inputs": [
            {
                "name": "enabled",
                "type": "bool",
                "indexed": false,
                "internalType": "bool"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "FreeMinerClaimed",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "spaceAmount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "MinerPurchased",
        "inputs": [
            {
                "name": "buyer",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "minerId",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "price",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "payValue",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "paymentToken",
                "type": "uint8",
                "indexed": false,
                "internalType": "enum Mining.PaymentToken"
            },
            {
                "name": "expectedReward",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OwnershipTransferred",
        "inputs": [
            {
                "name": "previousOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "RewardClaimed",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "amount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "vipFee",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "nodeFee",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "SignerUpdated",
        "inputs": [
            {
                "name": "oldSigner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newSigner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "UsdtFeeReceiverUpdated",
        "inputs": [
            {
                "name": "oldUsdtFeeReceiver",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newUsdtFeeReceiver",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "UsdtWithdrawn",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "amount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "ECDSAInvalidSignature",
        "inputs": []
    },
    {
        "type": "error",
        "name": "ECDSAInvalidSignatureLength",
        "inputs": [
            {
                "name": "length",
                "type": "uint256",
                "internalType": "uint256"
            }
        ]
    },
    {
        "type": "error",
        "name": "ECDSAInvalidSignatureS",
        "inputs": [
            {
                "name": "s",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ]
    },
    {
        "type": "error",
        "name": "ExpiredSignature",
        "inputs": [
            {
                "name": "deadline",
                "type": "uint256",
                "internalType": "uint256"
            }
        ]
    },
    {
        "type": "error",
        "name": "FreeMinerAlreadyClaimed",
        "inputs": []
    },
    {
        "type": "error",
        "name": "FreeMinerClaimDisabled",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidFee",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidFeeReceiver",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidPayValue",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidSignature",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidSigner",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NonceAlreadyUsed",
        "inputs": []
    },
    {
        "type": "error",
        "name": "OwnableInvalidOwner",
        "inputs": [
            {
                "name": "owner",
                "type": "address",
                "internalType": "address"
            }
        ]
    },
    {
        "type": "error",
        "name": "OwnableUnauthorizedAccount",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            }
        ]
    },
    {
        "type": "error",
        "name": "SafeERC20FailedOperation",
        "inputs": [
            {
                "name": "token",
                "type": "address",
                "internalType": "address"
            }
        ]
    },
    {
        "type": "error",
        "name": "UsdtPurchaseSpaceLimitExceeded",
        "inputs": []
    }
] as const satisfies Abi;

export const mining = {
    address: requiredEnv('MINING_CONTRACT_ADDRESS') as `0x${string}`,
    abi: miningAbi,
} as const;

export const nodeAbi = [
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "usdt_",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "treasury_",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "signer_",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "BPS_DENOMINATOR",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "REWARD_BPS",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "USDT",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "contract IERC20"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "claimReward",
        "inputs": [
            {
                "name": "amount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "deadline",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "signature",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "createLevel",
        "inputs": [
            {
                "name": "name",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "price",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "enabled",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getAllLevels",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "tuple[]",
                "internalType": "struct NodeMembership.LevelConfig[]",
                "components": [
                    {
                        "name": "name",
                        "type": "string",
                        "internalType": "string"
                    },
                    {
                        "name": "price",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "enabled",
                        "type": "bool",
                        "internalType": "bool"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getUpgradeCost",
        "inputs": [
            {
                "name": "userAddress",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "targetLevelIndex",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getUserLevel",
        "inputs": [
            {
                "name": "userAddress",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "levels",
        "inputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "name",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "price",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "enabled",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "purchase",
        "inputs": [
            {
                "name": "targetLevelIndex",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "signature",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "purchasePaused",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "renounceOwnership",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setPurchasePaused",
        "inputs": [
            {
                "name": "paused",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setSigner",
        "inputs": [
            {
                "name": "newSigner",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setTreasury",
        "inputs": [
            {
                "name": "newTreasury",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "signer",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "totalActivatedUsers",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "transferOwnership",
        "inputs": [
            {
                "name": "newOwner",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "treasury",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "upgrade",
        "inputs": [
            {
                "name": "targetLevelIndex",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "signature",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "usedClaimNonces",
        "inputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "users",
        "inputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "activated",
                "type": "bool",
                "internalType": "bool"
            },
            {
                "name": "levelIndex",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "totalPaid",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "event",
        "name": "LevelCreated",
        "inputs": [
            {
                "name": "levelIndex",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "name",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "price",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "enabled",
                "type": "bool",
                "indexed": false,
                "internalType": "bool"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "NodePurchased",
        "inputs": [
            {
                "name": "user",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "level",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "amount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "rewardAmount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OwnershipTransferred",
        "inputs": [
            {
                "name": "previousOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "PurchasePausedSet",
        "inputs": [
            {
                "name": "paused",
                "type": "bool",
                "indexed": false,
                "internalType": "bool"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "RewardClaimed",
        "inputs": [
            {
                "name": "user",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "amount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "SignerUpdated",
        "inputs": [
            {
                "name": "oldSigner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newSigner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "TreasuryUpdated",
        "inputs": [
            {
                "name": "oldTreasury",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newTreasury",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "AlreadyActivated",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidLevel",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidSignature",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidSigner",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidTreasury",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidUpgrade",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidUsdt",
        "inputs": []
    },
    {
        "type": "error",
        "name": "LevelDisabled",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NonceAlreadyUsed",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotActivated",
        "inputs": []
    },
    {
        "type": "error",
        "name": "OwnableInvalidOwner",
        "inputs": [
            {
                "name": "owner",
                "type": "address",
                "internalType": "address"
            }
        ]
    },
    {
        "type": "error",
        "name": "OwnableUnauthorizedAccount",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            }
        ]
    },
    {
        "type": "error",
        "name": "PurchasePausedError",
        "inputs": []
    },
    {
        "type": "error",
        "name": "ReentrancyGuardReentrantCall",
        "inputs": []
    },
    {
        "type": "error",
        "name": "SafeERC20FailedOperation",
        "inputs": [
            {
                "name": "token",
                "type": "address",
                "internalType": "address"
            }
        ]
    },
    {
        "type": "error",
        "name": "SignatureExpired",
        "inputs": []
    }
] as const satisfies Abi;

export const node = {
    address: requiredEnv('NODE_CONTRACT_ADDRESS') as `0x${string}`,
    abi: nodeAbi,
} as const;

export const spaceToken = requiredEnv('SPACE_TOKEN_ADDRESS') as `0x${string}`;
export const usdtToken = requiredEnv('USDT_TOKEN_ADDRESS') as `0x${string}`;
export const nodeFeeVault = requiredEnv('NODE_FEE_VAULT_ADDRESS') as `0x${string}`;
export const vipFeeVault = requiredEnv('VIP_FEE_VAULT_ADDRESS') as `0x${string}`;
