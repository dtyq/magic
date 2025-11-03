<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 组织默认额度
    'organization_default_amount' => 500000,
    // 组织RPM限流
    'organization_rpm_limit' => 1000,
    // 用户限流
    'user_rpm_limit' => 100,
    // 应用限流
    'app_rpm_limit' => 100,
    // AWS Bedrock 自动缓存开关
    'aws_bedrock_auto_cache' => env('LLM_AWS_BEDROCK_AUTO_CACHE', true),
    // OpenAI 兼容模型自动缓存开关
    'openai_auto_cache' => env('LLM_OPENAI_AUTO_CACHE', true),
];
