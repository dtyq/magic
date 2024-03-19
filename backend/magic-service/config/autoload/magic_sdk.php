<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'open_api_host' => env('MAGIC_OPEN_API_HOST', ''),
    'auth' => [
        'open_platform_host' => env('MAGIC_OPEN_PLATFORM_HOST', ''),
        'accounts' => [
            'app' => [
                'app_id' => '',
                'app_secret' => '',
            ],
        ],
    ],
];
