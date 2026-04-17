<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'model_aes_key' => env('SERVICE_PROVIDER_CONFIG_AES_KEY', ''),
    'office_organization' => env('OFFICE_ORGANIZATION', 'DT001'),
    'office_organization_name' => parse_json_config(env('OFFICE_ORGANIZATION_NAME', '{"zh_CN":"官方组织","en_US":"Official Organization"}')) ?: [
        'zh_CN' => '官方组织',
        'en_US' => 'Official Organization',
    ],
    'llm_model_file' => env('LLM_MODEL_FILE', BASE_PATH . '/storage/model/llm-models.json'),
];
