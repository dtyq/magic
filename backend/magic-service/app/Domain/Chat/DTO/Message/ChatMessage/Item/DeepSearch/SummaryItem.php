<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch;

use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageTrait;
use App\Domain\Chat\DTO\Message\Trait\LLMMessageTrait;
use App\Infrastructure\Core\AbstractObject;

/**
 * @property string $questionId 问题 id
 * @property string $content 总结内容
 * @property string $reasoningContent 思考过程
 */
class SummaryItem extends AbstractObject
{
    use LLMMessageTrait;
    use StreamMessageTrait;

    /**
     * 问题 id.
     */
    protected string $questionId;

    public function getQuestionId(): string
    {
        return $this->questionId;
    }

    public function setQuestionId(string $questionId): void
    {
        $this->questionId = $questionId;
    }
}
