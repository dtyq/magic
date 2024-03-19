<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\MicroAgent;

use App\Application\ModelGateway\MicroAgent\AgentParser\AgentParserFactory;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;

class MicroAgentFactory
{
    /**
     * Cache for already created MicroAgent instances.
     * @var array<string, MicroAgent>
     */
    private array $microAgents = [];

    public function __construct(protected AgentParserFactory $agentParserFactory)
    {
    }

    public static function fast(string $name): MicroAgent
    {
        return di(MicroAgentFactory::class)->getAgent($name);
    }

    /**
     * Get or create MicroAgent instance.
     *
     * @param string $name Agent name or cache key
     * @param null|string $filePath Optional custom agent file path
     */
    public function getAgent(string $name, ?string $filePath = null): MicroAgent
    {
        // Use file path as cache key if provided, otherwise use name
        $cacheKey = $filePath ?? $name;

        if (isset($this->microAgents[$cacheKey])) {
            return $this->microAgents[$cacheKey];
        }

        $data = $this->createAgent($name, $filePath);
        $agent = $data['micro_agent'];
        $cache = $data['cache'];
        if ($cache) {
            $this->microAgents[$cacheKey] = $agent;
        }

        return $agent;
    }

    /**
     * Check if agent exists in cache.
     */
    public function hasAgent(string $name, ?string $filePath = null): bool
    {
        $cacheKey = $filePath ?? $name;
        return isset($this->microAgents[$cacheKey]);
    }

    /**
     * Remove agent from cache.
     */
    public function removeAgent(string $name, ?string $filePath = null): void
    {
        $cacheKey = $filePath ?? $name;
        unset($this->microAgents[$cacheKey]);
    }

    /**
     * Clear all cached agents.
     */
    public function clearCache(): void
    {
        $this->microAgents = [];
    }

    /**
     * Get all cached agent names.
     */
    public function getCachedAgentNames(): array
    {
        return array_keys($this->microAgents);
    }

    /**
     * Get cache size.
     */
    public function getCacheSize(): int
    {
        return count($this->microAgents);
    }

    /**
     * Reload agent configuration from file (useful when config file changes).
     */
    public function reloadAgent(string $name, ?string $filePath = null): MicroAgent
    {
        $this->removeAgent($name, $filePath);
        return $this->getAgent($name, $filePath);
    }

    /**
     * Create a new MicroAgent instance.
     *
     * @param string $name Agent name
     * @param null|string $filePath Optional custom agent file path
     * @return array{micro_agent: MicroAgent, cache: bool}
     */
    private function createAgent(string $name, ?string $filePath = null): array
    {
        // Parse agent configuration
        if ($filePath !== null) {
            // Use specified file path
            $parsed = $this->agentParserFactory->getAgentContentFromFile($filePath);
        } else {
            // Use original logic with agent name
            $parsed = $this->agentParserFactory->getAgentContent($name);
        }

        $config = $parsed['config'];
        $modelId = $config['model_id'] ?? '';
        $enabled = true;
        $cache = true;

        $aiAbilityCode = AiAbilityCode::tryFrom($config['ai_ability_code'] ?? '');
        if (! empty($aiAbilityCode)) {
            // 获取 ai 能力的动态模型配置
            $dataIsolation = ProviderDataIsolation::create()->disabled();
            $aiAbility = di(AiAbilityDomainService::class)->getByCode($dataIsolation, $aiAbilityCode);
            if ($aiAbility && ! empty($aiAbility->getConfig()['model_id'])) {
                $modelId = $aiAbility->getConfig()['model_id'];
                // 如果有 ai 能力配置，则不要缓存了
                $cache = false;
            }
            $enabled = $aiAbility?->isEnabled() ?? true;
        }

        $microAgent = new MicroAgent(
            name: $name,
            modelId: $modelId,
            systemTemplate: $parsed['system'],
            temperature: $config['temperature'] ?? 0.7,
            maxTokens: max(0, (int) ($config['max_tokens'] ?? 0)),
            enabledModelFallbackChain: $config['enabled_model_fallback_chain'] ?? true,
            modelFallbackChainLimit: max(1, (int) ($config['model_fallback_chain_limit'] ?? 3)),
            modelFallbackChainThrowFallback: $config['model_fallback_chain_throw_fallback'] ?? false,
            enabled: $enabled,
        );

        return [
            'micro_agent' => $microAgent,
            'cache' => $cache,
        ];
    }
}
