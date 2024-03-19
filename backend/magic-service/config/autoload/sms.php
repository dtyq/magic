<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use function Hyperf\Support\env;

return [
    // 一天最多发送次数
    'day_max_count' => 30,
    // 每次发送间隔60s
    'time_interval' => 60,
    'volcengine' => [
        'accessKey' => env('VOLCENGINE_SMS_ACCESS_KEY', ''),
        'secretKey' => env('VOLCENGINE_SMS_SECRET_KEY', ''),
    ],
];
