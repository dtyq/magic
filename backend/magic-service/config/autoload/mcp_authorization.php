<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
$serviceBaseUrl = rtrim((string) env('APP_HOST', ''), '/');

return [
    'encryption_key' => env('MCP_AUTHORIZATION_ENCRYPTION_KEY', env('SHARE_ENCRYPT_KEY', '')),
    // OAuth 授权完成后的固定 magic-service 回调地址，不使用前端传入的 redirect_url。
    'callback_url' => $serviceBaseUrl . '/api/v1/mcp/authorization/callback',
    'state_ttl' => (int) env('MCP_AUTHORIZATION_STATE_TTL', 600),
    'token_expiry_leeway' => (int) env('MCP_AUTHORIZATION_TOKEN_EXPIRY_LEEWAY', 30),
];
