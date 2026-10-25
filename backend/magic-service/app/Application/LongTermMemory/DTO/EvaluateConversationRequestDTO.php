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

    /**
     * 模型调用来源。
     */
    public string $sourceId = '';

    /**
     * 模型调用关联的业务对象标识。
     */
    public string $businessId = '';
}
