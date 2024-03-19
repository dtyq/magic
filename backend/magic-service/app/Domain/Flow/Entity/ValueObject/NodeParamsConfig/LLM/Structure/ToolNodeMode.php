<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure;

enum ToolNodeMode: string
{
    case PARAMETER = 'parameter';
    case LLM = 'llm';

    public function isLLM(): bool
    {
        return $this === self::LLM;
    }
}
