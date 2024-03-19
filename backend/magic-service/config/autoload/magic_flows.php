<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'default_embedding_model' => 'dmeta-embedding',
    'vector' => [
        'odin_qdrant' => [
            'base_uri' => \Hyperf\Support\env('ODIN_QDRANT_BASE_URI', 'http://127.0.0.1:6333'),
            'api_key' => \Hyperf\Support\env('ODIN_QDRANT_API_KEY', ''),
        ],
    ],

    'model_aes_key' => env('MAGIC_FLOW_MODEL_AES_KEY'),
];
