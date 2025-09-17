<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\MicroAgent;

use App\Application\ModelGateway\MicroAgent\AgentParser\AgentParserFactory;

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

        $agent = $this->createAgent($name, $filePath);
        $this->microAgents[$cacheKey] = $agent;

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
     */
    private function createAgent(string $name, ?string $filePath = null): MicroAgent
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

        return new MicroAgent(
            name: $name,
            modelId: $config['model_id'] ?? '',
            systemTemplate: $parsed['system'],
            temperature: $config['temperature'] ?? 0.7,
            maxTokens: max(0, (int) ($config['max_tokens'] ?? 0)),
            enabledModelFallbackChain: $config['enabled_model_fallback_chain'] ?? true,
        );
    }
}
