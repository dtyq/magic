<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

/**
 * 聊天请求参数，保留旧思考配置并接收统一思考强度。
 */
class CompletionDTO extends AbstractRequestDTO
{
    protected array $messages = [];

    protected ?float $temperature = 0.9;

    /**
     * @var null|int -1 代表用配置的最大值
     */
    protected ?int $maxTokens = 0;

    protected ?array $stop = [];

    protected ?array $tools = [];

    protected bool $stream = false;

    protected ?array $streamOptions = null;

    protected string $prompt = '';

    protected float $frequencyPenalty = 0.0;

    protected float $presencePenalty = 0.0;

    protected ?array $thinking = null;

    /** 请求值原样交给 Odin，避免中间层绑定其档位与类型规则。 */
    protected mixed $reasoningEffort = null;

    /** 每次路由后的默认值与用户选择分开，避免重试沿用上一候选的默认。 */
    private ?string $modelReasoningEffortDefault = null;

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

    /** 更新当前实际模型默认值，不修改请求中的原始用户选择。 */
    public function setModelReasoningEffortDefault(?string $level): void
    {
        $this->modelReasoningEffortDefault = $level;
    }

    /** 明确强度优先，旧 thinking 继续有效；省略两者才应用模型默认。 */
    public function getEffectiveReasoningEffort(): mixed
    {
        return $this->reasoningEffort ?? ($this->thinking === null ? $this->modelReasoningEffortDefault : null);
    }

    /**
     * 获取统一思考强度，空值表示回退旧思考配置或模型默认值。
     */
    public function getReasoningEffort(): mixed
    {
        return $this->reasoningEffort;
    }

    /**
     * 原样保存请求强度，档位、类型及供应商能力校验统一交给 Odin。
     */
    public function setReasoningEffort(mixed $reasoningEffort): void
    {
        $this->reasoningEffort = $reasoningEffort;
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
