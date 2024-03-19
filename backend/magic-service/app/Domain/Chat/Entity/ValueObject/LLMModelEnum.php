<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

/**
 * 模型管理后台 model_id 可能支持类型的枚举值。
 * 不要枚举服务商的接入点，这里是与服务商无关的配置.
 */
enum LLMModelEnum: string
{
    case GEMMA2_2B = 'gemma2-2b';
    case GPT_4O = 'gpt-4o';
    case GPT_41 = 'gpt-4.1';
    case DEEPSEEK_R1 = 'deepseek-r1';
    case DEEPSEEK_V3 = 'deepseek-v3';
    case DEEPSEEK_V32 = 'deepseek-v3.2';
    case QWEN3_CODER_PLUS = 'qwen3-coder-plus';
    case QWEN3_CODER_FLASH = 'qwen3-coder-flash';
}
