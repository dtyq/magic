<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 知识库默认嵌入模型
    'default_embedding_model' => env('KNOWLEDGE_BASE_DEFAULT_EMBEDDING_MODEL', 'text-embedding-3-small'),

    'vector' => [
        'odin_qdrant' => [
            'base_uri' => env('ODIN_QDRANT_BASE_URI', 'http://127.0.0.1:6333'),
            'api_key' => env('ODIN_QDRANT_API_KEY', ''),
        ],
    ],

    'model_aes_key' => env('MAGIC_FLOW_MODEL_AES_KEY'),
];
