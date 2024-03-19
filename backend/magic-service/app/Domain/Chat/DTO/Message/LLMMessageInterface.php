<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message;

/**
 * 大模型回复的消息.
 */
interface LLMMessageInterface extends TextContentInterface
{
    // 推理内容
    public function getReasoningContent(): ?string;

    public function setReasoningContent(?string $reasoningContent): static;

    // 不包含推理内容的大模型响应
    public function getContent(): string;

    public function setContent(string $content): static;
}
