<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'applications' => [
        'default' => [
            'type' => 'open_dev',
            'options' => [
                'app_key' => env('OPEN_DEV_APP_KEY', ''),
                'app_secret' => env('OPEN_DEV_APP_SECRET', ''),
                'callback_config' => [
                    'token' => env('OPEN_DEV_CALLBACK_TOKEN'),
                    'aes_key' => env('OPEN_DEV_CALLBACK_AES_KEY'),
                ],
            ],
        ],
    ],
];
