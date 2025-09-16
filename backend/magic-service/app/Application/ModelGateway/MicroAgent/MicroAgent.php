<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\MicroAgent;

use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Service\ModelConfigAppService;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Message\SystemMessage;
use Hyperf\Odin\Message\UserMessage;

class MicroAgent
{
    public function __construct(
        protected string $name,
        protected string $modelId = '',
        protected string $systemTemplate = '',
        protected float $temperature = 0.7,
        protected int $maxTokens = 0,
        protected bool $enabledModelFallbackChain = true,
        protected array $tools = [],
    ) {
    }

    /**
     * Execute agent with given parameters.
     */
    public function easyCall(string $organizationCode, array $systemReplace = [], string $userPrompt = '', array $businessParams = []): ChatCompletionResponse
    {
        // Replace variables in system content
        $systemContent = $this->replaceSystemVariables($systemReplace);

        if (empty($systemContent)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'system_content']);
        }

        $systemPrompt = new SystemMessage($systemContent);

        // Get model ID with fallback chain if enabled
        $modelId = $this->getResolvedModelId($organizationCode);

        $messages = [
            $systemPrompt,
        ];
        if ($userPrompt !== '') {
            $messages[] = new UserMessage($userPrompt);
        }

        $modelGatewayMapper = di(ModelGatewayMapper::class);

        $model = $modelGatewayMapper->getChatModelProxy($modelId, $organizationCode);
        return $model->chat(
            messages: $messages,
            temperature: $this->temperature,
            maxTokens: $this->maxTokens,
            tools: $this->tools,
            businessParams: $businessParams
        );
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function getSystemTemplate(): string
    {
        return $this->systemTemplate;
    }

    public function getTemperature(): float
    {
        return $this->temperature;
    }

    public function getMaxTokens(): int
    {
        return $this->maxTokens;
    }

    public function isEnabledModelFallbackChain(): bool
    {
        return $this->enabledModelFallbackChain;
    }

    public function getTools(): array
    {
        return $this->tools;
    }

    /**
     * Set tools for the agent.
     */
    public function setTools(array $tools): void
    {
        $this->tools = $tools;
    }

    /**
     * Add a tool to the agent.
     */
    public function addTool(array $tool): void
    {
        $this->tools[] = $tool;
    }

    /**
     * Clear all tools.
     */
    public function clearTools(): void
    {
        $this->tools = [];
    }

    /**
     * Set tools and return self for method chaining.
     */
    public function withTools(array $tools): self
    {
        $this->tools = $tools;
        return $this;
    }

    /**
     * Replace variables in system template.
     */
    private function replaceSystemVariables(array $variables = []): string
    {
        if (empty($variables)) {
            return $this->systemTemplate;
        }

        $systemContent = $this->systemTemplate;
        foreach ($variables as $key => $value) {
            $pattern = '/\{\{' . preg_quote($key, '/') . '\}\}/';
            $systemContent = preg_replace($pattern, (string) $value, $systemContent);
        }

        return $systemContent;
    }

    /**
     * Get resolved model ID with fallback chain if enabled.
     */
    private function getResolvedModelId(string $organizationCode): string
    {
        if ($this->enabledModelFallbackChain) {
            return di(ModelConfigAppService::class)->getChatModelTypeByFallbackChain($organizationCode, $this->modelId);
        }

        return $this->modelId;
    }
}
