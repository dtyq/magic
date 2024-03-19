<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 国内magic
    'domestic_magic_service' => [
        'host' => env('DOMESTIC_MAGIC_HOST'),
    ],
    // 国际magic
    'international_magic_service' => [
        'host' => env('INTERNATIONAL_MAGIC_HOST'),
    ],
];
