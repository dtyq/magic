<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\StreamMessage;

trait StreamMessageTrait
{
    protected ?StreamOptions $streamOptions;

    // 消息是否是流式消息
    public function isStream(): bool
    {
        return (bool) $this->getStreamOptions()?->isStream();
    }

    public function setStream(bool $stream): static
    {
        $this->getStreamOptions()?->setStream($stream);
        return $this;
    }

    public function getStreamOptions(): ?StreamOptions
    {
        return $this->streamOptions ?? null;
    }

    public function setStreamOptions(null|array|StreamOptions $streamOptions): static
    {
        if (is_array($streamOptions)) {
            $this->streamOptions = new StreamOptions($streamOptions);
        } elseif ($streamOptions instanceof StreamOptions) {
            $this->streamOptions = $streamOptions;
        } else {
            $this->streamOptions = null;
        }
        return $this;
    }
}
