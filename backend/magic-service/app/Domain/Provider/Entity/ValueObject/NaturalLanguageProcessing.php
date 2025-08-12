<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

enum NaturalLanguageProcessing: string
{
    case DEFAULT = 'default';
    case EMBEDDING = 'embedding'; // 嵌入
    case LLM = 'llm'; // 大语言
}
