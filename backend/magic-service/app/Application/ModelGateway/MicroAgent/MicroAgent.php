<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\MicroAgent;

use App\Application\ModelGateway\Mapper\ModelFallbackChainManager;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Message\SystemMessage;
use Hyperf\Odin\Message\UserMessage;
use Nyholm\Psr7\Response;

class MicroAgent
{
    public function __construct(
        protected string $name,
        protected string $modelId = '',
        protected string $systemTemplate = '',
        protected float $temperature = 0.7,
        protected int $maxTokens = 0,
        protected bool $enabledModelFallbackChain = true,
        protected int $modelFallbackChainLimit = 3,
        protected bool $modelFallbackChainThrowFallback = false,
        protected array $tools = [],
        protected bool $enabled = true,
    ) {
    }

    /**
     * Execute agent with given parameters.
     */
    public function easyCall(ModelGatewayDataIsolation $dataIsolation, array $systemReplace = [], null|string|UserMessage $userPrompt = null, array $businessParams = []): ChatCompletionResponse
    {
        // 不参与套餐限制
        $dataIsolation->getSubscriptionManager()->setEnabled(false);

        // Replace variables in system content
        $systemContent = $this->replaceSystemVariables($systemReplace);

        if (empty($systemContent)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'system_content']);
        }

        $systemPrompt = new SystemMessage($systemContent);

        // Get model ID with fallback chain if enabled
        $modelId = $this->getResolvedModelId($dataIsolation);
        if ($modelId === '') {
            // 回退链返回空：当前组织无可用模型，视为本能力不可用，返回空补全而非继续请求网关
            return $this->createUnavailableModelChatCompletionResponse();
        }

        $messages = [
            $systemPrompt,
        ];
        if ($userPrompt) {
            if ($userPrompt instanceof UserMessage) {
                $messages[] = $userPrompt;
            } else {
                // 此时 $userPrompt 必然是 non-falsy-string
                $messages[] = new UserMessage($userPrompt);
            }
        }

        $modelGatewayMapper = di(ModelGatewayMapper::class);

        return $modelGatewayMapper->getChatModelProxy($dataIsolation, $modelId)->chat(
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

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function setModelId(string $modelId): void
    {
        $this->modelId = $modelId;
    }

    public function setSystemTemplate(string $systemTemplate): void
    {
        $this->systemTemplate = $systemTemplate;
    }

    public function setTemperature(float $temperature): void
    {
        $this->temperature = $temperature;
    }

    public function setMaxTokens(int $maxTokens): void
    {
        $this->maxTokens = $maxTokens;
    }

    public function setEnabledModelFallbackChain(bool $enabledModelFallbackChain): void
    {
        $this->enabledModelFallbackChain = $enabledModelFallbackChain;
    }

    public function getModelFallbackChainLimit(): int
    {
        return $this->modelFallbackChainLimit;
    }

    public function setModelFallbackChainLimit(int $modelFallbackChainLimit): void
    {
        $this->modelFallbackChainLimit = $modelFallbackChainLimit;
    }

    public function getModelFallbackChainThrowFallback(): bool
    {
        return $this->modelFallbackChainThrowFallback;
    }

    public function setModelFallbackChainThrowFallback(bool $modelFallbackChainThrowFallback): void
    {
        $this->modelFallbackChainThrowFallback = $modelFallbackChainThrowFallback;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
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
    private function getResolvedModelId(ModelGatewayDataIsolation $dataIsolation): string
    {
        if ($this->enabledModelFallbackChain) {
            $modelIds = di(ModelFallbackChainManager::class)->get(
                $dataIsolation,
                $this->modelId,
                'chat',
                $this->modelFallbackChainLimit,
                $this->modelFallbackChainThrowFallback
            );
            return implode(',', $modelIds);
        }

        return $this->modelId;
    }

    /**
     * 模型不可用（如无可用 chat 模型）时返回与 Odin 兼容的响应：choices 为空数组，表示无补全结果。
     */
    private function createUnavailableModelChatCompletionResponse(): ChatCompletionResponse
    {
        $payload = [
            'id' => 'model-fallback-unavailable',
            'object' => 'chat.completion',
            'created' => time(),
            'model' => '',
            'choices' => [],
        ];
        $json = json_encode($payload) ?: '{"id":"model-fallback-unavailable","object":"chat.completion","choices":[]}';
        $psrResponse = new Response(200, ['Content-Type' => 'application/json'], $json);

        return new ChatCompletionResponse($psrResponse);
    }
}
