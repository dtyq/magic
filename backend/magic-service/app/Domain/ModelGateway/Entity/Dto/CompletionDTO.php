<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

class CompletionDTO extends AbstractRequestDTO
{
    protected array $messages = [];

    protected ?float $temperature = 0.9;

    protected ?int $maxTokens = 0;

    protected ?array $stop = [];

    protected ?array $tools = [];

    protected bool $stream = false;

    protected ?array $streamOptions = null;

    protected string $prompt = '';

    protected float $frequencyPenalty = 0.0;

    protected float $presencePenalty = 0.0;

    protected ?array $thinking = null;

    public function __construct(?array $data = null)
    {
        parent::__construct($data);
    }

    public function getType(): string
    {
        return 'chat';
    }

    public function getMessages(): array
    {
        return $this->messages;
    }

    public function setMessages(array $messages): void
    {
        $this->messages = $messages;
    }

    public function getTemperature(): ?float
    {
        return $this->temperature;
    }

    public function setTemperature(?float $temperature): void
    {
        $this->temperature = $temperature;
    }

    public function getMaxTokens(): ?int
    {
        return $this->maxTokens;
    }

    public function setMaxTokens(?int $maxTokens): void
    {
        $this->maxTokens = $maxTokens;
    }

    public function getStop(): ?array
    {
        return $this->stop;
    }

    public function setStop(?array $stop): void
    {
        $this->stop = $stop;
    }

    public function getTools(): ?array
    {
        return $this->tools;
    }

    public function setTools(?array $tools): void
    {
        $this->tools = $tools;
    }

    public function isStream(): bool
    {
        return $this->stream;
    }

    public function setStream(bool $stream): void
    {
        $this->stream = $stream;
    }

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function setPrompt(string $prompt): void
    {
        $this->prompt = $prompt;
    }

    public function getFrequencyPenalty(): float
    {
        return $this->frequencyPenalty;
    }

    public function setFrequencyPenalty(float $frequencyPenalty): void
    {
        $this->frequencyPenalty = $frequencyPenalty;
    }

    public function getPresencePenalty(): float
    {
        return $this->presencePenalty;
    }

    public function setPresencePenalty(float $presencePenalty): void
    {
        $this->presencePenalty = $presencePenalty;
    }

    public function getThinking(): ?array
    {
        return $this->thinking;
    }

    public function setThinking(?array $thinking): void
    {
        $this->thinking = $thinking;
    }

    public function getStreamOptions(): ?array
    {
        return $this->streamOptions;
    }

    public function setStreamOptions(?array $streamOptions): void
    {
        $this->streamOptions = $streamOptions;
    }

    public function shouldIncludeUsageInStream(): bool
    {
        return $this->stream
               && isset($this->streamOptions['include_usage'])
               && $this->streamOptions['include_usage'] === true;
    }
}
