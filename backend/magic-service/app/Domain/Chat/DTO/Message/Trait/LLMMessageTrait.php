<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Trait;

/**
 * 大模型的响应.
 */
trait LLMMessageTrait
{
    protected ?string $reasoningContent;

    protected string $content = '';

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(string $content): static
    {
        $this->content = $content;
        return $this;
    }

    public function getReasoningContent(): ?string
    {
        return $this->reasoningContent ?? null;
    }

    public function setReasoningContent(?string $reasoningContent): static
    {
        $this->reasoningContent = $reasoningContent;
        return $this;
    }

    public function getTextContent(): string
    {
        return $this->getContent();
    }
}
