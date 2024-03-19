<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'watermark_aes_key' => env('WATERMARK_SIGN_AES_KEY', ''),
    'watermark_sign_salt' => env('WATERMARK_SIGN_SALT', 'super-magic'),
    'midjourney' => [
        'host' => env('MIDJOURNEY_HOST'),
        'api_key' => env('MIDJOURNEY_API_KEY'),
    ],
    'volcengine' => [
        'ak' => env('VOLCENGINE_TEXT_IMAGE_GENERATE_AK'),
        'sk' => env('VOLCENGINE_TEXT_IMAGE_GENERATE_SK'),
    ],
    'flux' => [
        'host' => env('FLUX_HOST', ''),
        'api_key' => env('FLUX_API_KEY', ''),
    ],
    'miracle_vision' => [
        'key' => env('MIRACLE_VISION_KEY'),
        'secret' => env('MIRACLE_VISION_SECRET'),
    ],
    'alert' => [
        'access_token' => env('IMG_GENERATE_ALERT_ACCESS_TOKEN'),
    ],
    'gpt4o' => [
        'host' => env('GPT4o_HOST', ''),
        'api_key' => env('GPT4o_API_KEY', ''),
    ],
    // 超级麦吉AIGC隐式标识配置
    'aigc_metadata' => [
        'label' => env('AIGC_LABEL', '1'), // AIGC标签
        'content_producer' => env('AIGC_CONTENT_PRODUCER', '001191440300MA5HTEC8X100000'), // 内容生产者统一社会信用代码
    ],
];
