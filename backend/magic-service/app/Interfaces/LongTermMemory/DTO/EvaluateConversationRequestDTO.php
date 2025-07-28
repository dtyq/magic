<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\LongTermMemory\DTO;

use App\Domain\Chat\Entity\ValueObject\LLMModelEnum;
use App\Infrastructure\Core\AbstractDTO;

/**
 * 评估对话内容请求DTO.
 */
class EvaluateConversationRequestDTO extends AbstractDTO
{
    /**
     * 对话内容.
     */
    public string $conversationContent = '';

    /**
     * 使用的模型名称.
     */
    public string $modelName = LLMModelEnum::DEEPSEEK_V3->value;

    public function getConversationContent(): string
    {
        return $this->conversationContent;
    }

    public function setConversationContent(string $conversationContent): void
    {
        $this->conversationContent = $conversationContent;
    }

    public function getModelName(): string
    {
        return $this->modelName;
    }

    public function setModelName(string $modelName): void
    {
        $this->modelName = $modelName;
    }
}
