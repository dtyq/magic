<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Domain\Chat\Entity\ValueObject\LLMModelEnum;
use Hyperf\Codec\Json;

use function Hyperf\Support\env;

return [
    // rpm配置
    'rpm_config' => [
        // 组织RPM限流
        'organization' => 1000,
        // 用户限流
        'user' => 100,
        // 应用限流
        'app' => 100,
    ],
    // 默认额度配置
    'default_amount_config' => [
        // 组织默认额度
        'organization' => 500000,
        // 个人默认额度
        'user' => 1000,
    ],
    // 全局的模型降级链
    'model_fallback_chain' => [
        // 聊天模型
        'chat' => Json::decode(env('CHAT_MODEL_FALLBACK_CHAIN', '{}')) ?: [LLMModelEnum::GPT_41->value, LLMModelEnum::GPT_4O->value, LLMModelEnum::DEEPSEEK_V3->value],
        // 嵌入
        'embedding' => [],
    ],
    // 访问国外的代理配置
    'http' => [
        'proxy' => env('HTTP_PROXY'),
    ],
];
