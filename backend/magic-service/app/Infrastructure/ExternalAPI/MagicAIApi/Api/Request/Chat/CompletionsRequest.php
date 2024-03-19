<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\MagicAIApi\Api\Request\Chat;

use App\Infrastructure\ExternalAPI\MagicAIApi\Kernel\AbstractRequest;

class CompletionsRequest extends AbstractRequest
{
    public function __construct(
        private readonly string $model,
        private readonly array $messages = [],
        private readonly float $temperature = 0.5,
        private readonly int $maxTokens = 0,
        private readonly array $stop = [],
        private readonly array $tools = [],
        private readonly bool $stream = false
    ) {
    }

    public function toBody(): array
    {
        return [
            'model' => $this->model,
            'messages' => $this->messages,
            'temperature' => $this->temperature,
            'max_tokens' => $this->maxTokens,
            'stop' => $this->stop,
            'tools' => $this->tools,
            'stream' => $this->stream,
        ];
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function getMessages(): array
    {
        return $this->messages;
    }

    public function getTemperature(): float
    {
        return $this->temperature;
    }

    public function getMaxTokens(): int
    {
        return $this->maxTokens;
    }

    public function getStop(): array
    {
        return $this->stop;
    }

    public function getTools(): array
    {
        return $this->tools;
    }

    public function isStream(): bool
    {
        return $this->stream;
    }
}
