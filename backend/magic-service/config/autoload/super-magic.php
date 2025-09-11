<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'phones' => [],
    'task_number_limit' => 3,
    'user_task_limits' => [],
    'sandbox' => [
        'gateway' => \Hyperf\Support\env('SANDBOX_GATEWAY', ''),
        'token' => \Hyperf\Support\env('SANDBOX_TOKEN', ''),
        'enabled' => \Hyperf\Support\env('SANDBOX_ENABLE', true),
        'message_mode' => \Hyperf\Support\env('SANDBOX_MESSAGE_MODE', 'consume'),
        'callback_host' => \Hyperf\Support\env('APP_HOST', ''),
        'deployment_id' => \Hyperf\Support\env('DEPLOYMENT_ID', ''),
    ],
    'share' => [
        'encrypt_key' => \Hyperf\Support\env('SHARE_ENCRYPT_KEY', ''),
        'encrypt_iv' => \Hyperf\Support\env('SHARE_ENCRYPT_IV', ''),
    ],
    'task' => [
        'tool_message' => [
            'object_storage_enabled' => \Hyperf\Support\env('TOOL_MESSAGE_OBJECT_STORAGE_ENABLED', true),
            'min_content_length' => \Hyperf\Support\env('TOOL_MESSAGE_MIN_CONTENT_LENGTH', 200),
        ],
        'check_task_crontab' => [
            'enabled' => \Hyperf\Support\env('CHECK_TASK_CRONTAB_ENABLED', true),
        ],
    ],
    'message' => [
        'process_mode' => \Hyperf\Support\env('SUPER_MAGIC_MESSAGE_PROCESS_MODE', 'direct'), // direct OR queue
        'enable_compensate' => \Hyperf\Support\env('SUPER_MAGIC_MESSAGE_ENABLE_COMPENSATE', false),
    ],
    'user_message_queue' => [
        'enabled' => \Hyperf\Support\env('USER_MESSAGE_QUEUE_ENABLED', true),
        'whitelist' => array_filter(explode(',', \Hyperf\Support\env('USER_MESSAGE_QUEUE_WHITELIST', ''))),
    ],
    'file_version' => [
        'max_versions' => \Hyperf\Support\env('FILE_VERSION_MAX_VERSIONS', 10),
    ],
];
