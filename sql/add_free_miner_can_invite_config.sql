INSERT INTO config (key, value, "desc", "isAdminEditable")
VALUES (
  'FREE_MINER_CAN_INVITE',
  '1',
  '免费矿机是否可以邀请，1 表示可以，0 表示不可以；付费矿机邀请不受影响',
  true
)
ON CONFLICT (key) DO NOTHING;
