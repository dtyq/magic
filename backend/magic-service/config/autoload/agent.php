<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 这里暂时指定 magic-mind-search 的 AI Code。 它使用硬编码的方式给出搜索结果，而不是走 flow 的逻辑。
    'deep_search' => [
        'ai_code' => env('AGGREGATE_SEARCH_AI_CODE', 'MAGIC-FLOW-672c6375371f51-29426462'),
    ],
    'ai_image' => [
        'ai_code' => env('AI_IMAGE_AI_CODE', 'MAGIC-FLOW-676523f6047b56-15495224'),
    ],
    'simple_search' => [
        'ai_code' => env('SIMPLE_SEARCH_AI_CODE', 'MAGIC-FLOW-67664dea979e49-60291002'),
    ],
    'default_conversation_ai_codes' => env('DEFAULT_CONVERSATION_AI_CODES'),
];
