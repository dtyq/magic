<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\LongTermMemory\DTO;

use App\Domain\Chat\Entity\ValueObject\LLMModelEnum;
use App\Infrastructure\Core\AbstractDTO;

class EvaluateConversationRequestDTO extends AbstractDTO
{
    public string $modelName = LLMModelEnum::DEEPSEEK_V3->value;

    public string $appId;

    public string $conversationContent;

    public array $tags = [];
}
