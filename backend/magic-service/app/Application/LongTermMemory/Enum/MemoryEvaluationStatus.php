<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\LongTermMemory\Enum;

/**
 * 记忆评估状态枚举.
 */
enum MemoryEvaluationStatus: string
{
    case NO_MEMORY_NEEDED = 'no_memory_needed';
    case CREATED = 'created';
    case NOT_CREATED_LOW_SCORE = 'not_created_low_score';
}
