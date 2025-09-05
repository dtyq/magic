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
     */
    public function getAgent(string $name): MicroAgent
    {
        if (isset($this->microAgents[$name])) {
            return $this->microAgents[$name];
        }

        $agent = $this->createAgent($name);
        $this->microAgents[$name] = $agent;

        return $agent;
    }

    /**
     * Check if agent exists in cache.
     */
    public function hasAgent(string $name): bool
    {
        return isset($this->microAgents[$name]);
    }

    /**
     * Remove agent from cache.
     */
    public function removeAgent(string $name): void
    {
        unset($this->microAgents[$name]);
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
    public function reloadAgent(string $name): MicroAgent
    {
        $this->removeAgent($name);
        return $this->getAgent($name);
    }

    /**
     * Create a new MicroAgent instance.
     */
    private function createAgent(string $name): MicroAgent
    {
        // Parse agent configuration
        $parsed = $this->agentParserFactory->getAgentContent($name);
        $config = $parsed['config'];

        return new MicroAgent(
            name: $name,
            modelId: $config['model_id'] ?? '',
            systemTemplate: $parsed['system'],
            temperature: $config['temperature'] ?? 0.7,
            enabledModelFallbackChain: $config['enabled_model_fallback_chain'] ?? true,
        );
    }
}
