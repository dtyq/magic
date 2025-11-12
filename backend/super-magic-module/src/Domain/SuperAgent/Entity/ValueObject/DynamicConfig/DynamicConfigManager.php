<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DynamicConfig;

use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;
use Psr\Container\ContainerInterface;
use Throwable;

class DynamicConfigManager
{
    /**
     * Redis key prefix for dynamic configurations.
     */
    private const REDIS_KEY_PREFIX = 'dynamic_config:';

    /**
     * Default TTL for configurations (60 seconds).
     */
    private const DEFAULT_TTL = 60;

    private RedisProxy $redis;

    public function __construct(ContainerInterface $container)
    {
        $this->redis = $container->get(RedisFactory::class)->get('default');
    }

    /**
     * Add or update dynamic configuration by task ID and config key.
     *
     * @param string $taskId Task identifier
     * @param string $key Configuration key (e.g., 'non_human_options', 'models')
     * @param mixed $config Configuration data
     * @param int $ttl Time to live in seconds (default: 60)
     * @return bool True if config was saved successfully, false otherwise
     */
    public function addByTaskId(string $taskId, string $key, mixed $config, int $ttl = self::DEFAULT_TTL): bool
    {
        try {
            $redisKey = $this->buildRedisKey($taskId);

            // Get existing configuration
            $existingConfigJson = $this->redis->get($redisKey);
            $existingConfig = [];

            if ($existingConfigJson !== null && $existingConfigJson !== false) {
                $existingConfig = json_decode($existingConfigJson, true, 512, JSON_THROW_ON_ERROR) ?: [];
            }

            // Update the specific configuration section
            $existingConfig[$key] = $config;

            // Save the updated configuration
            $configJson = json_encode($existingConfig, JSON_THROW_ON_ERROR);
            $result = $this->redis->setex($redisKey, $ttl, $configJson);

            return (bool) $result;
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * Get all dynamic configurations by task ID.
     *
     * @param string $taskId Task identifier
     * @return array Complete configuration object for the task
     */
    public function getByTaskId(string $taskId): array
    {
        try {
            $redisKey = $this->buildRedisKey($taskId);
            $configJson = $this->redis->get($redisKey);

            if ($configJson === null || $configJson === false) {
                return [];
            }

            return json_decode($configJson, true, 512, JSON_THROW_ON_ERROR) ?: [];
        } catch (Throwable) {
            return [];
        }
    }

    /**
     * Clear all dynamic configurations for a task.
     *
     * @param string $taskId Task identifier
     * @return bool True if all configs were cleared successfully, false otherwise
     */
    public function clearByTaskId(string $taskId): bool
    {
        try {
            $redisKey = $this->buildRedisKey($taskId);
            $result = $this->redis->del($redisKey);

            return $result > 0;
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * Build Redis key for dynamic configuration.
     *
     * @param string $taskId Task identifier
     * @return string Redis key
     */
    private function buildRedisKey(string $taskId): string
    {
        return self::REDIS_KEY_PREFIX . $taskId;
    }
}
