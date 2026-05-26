<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'default' => env('WEATHER_DEFAULT_DRIVER', 'aidata'),
    'drivers' => [
        'aidata' => [
            'api_key' => env('AIDATA_API_KEY', ''),
            'base_url' => env('AIDATA_BASE_URL', ''),
        ],
    ],
];
