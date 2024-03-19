<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // Token related errors
    'token' => [
        'not_exist' => 'API token does not exist',
        'disabled' => 'API token has been disabled',
        'expired' => 'API token has expired',
        'model_not_support' => 'Token does not support this model',
        'organization_not_support' => 'Token does not support this organization',
        'ip_not_in_white_list' => 'IP address is not in the whitelist',
        'quota_not_enough' => 'Token quota is insufficient',
        'calculate_error' => 'Token calculation error',
        'create_error' => 'Failed to create token',
    ],

    // Model related errors
    'model' => [
        'not_support' => 'Model is not supported',
        'response_fail' => 'Model response failed',
    ],

    // Organization related errors
    'organization' => [
        'quota_not_enough' => 'Organization quota is insufficient',
    ],

    // Message related errors
    'message' => [
        'empty' => 'Message cannot be empty',
    ],

    // User related errors
    'user' => [
        'create_access_token_limit' => 'User has exceeded the limit for creating access tokens',
        'use_access_token_limit' => 'User has exceeded the limit for using access tokens',
        'create_access_token_rate_limit' => 'User is rate limited for creating access tokens',
    ],

    // General errors
    'rate_limit' => 'Rate limit exceeded',
    'msg_empty' => 'Message is empty',
    'user_id_not_exist' => 'User ID does not exist',
    'validate_failed' => 'Validation failed',
];
