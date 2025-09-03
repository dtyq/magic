<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Cache\StringCache;

use App\Domain\Flow\Entity\MagicFlowCacheEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Service\MagicFlowCacheDomainService;
use Exception;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * MySQL-based string cache implementation using Domain Service.
 */
class MysqlStringCache implements StringCacheInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly MagicFlowCacheDomainService $magicFlowCacheDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('MysqlStringCache');
    }

    public function set(FlowDataIsolation $dataIsolation, string $prefix, string $key, string $value, int $ttl = 7200): bool
    {
        try {
            $entity = new MagicFlowCacheEntity();
            $entity->setCachePrefix($prefix);
            $entity->setCacheKey($key);
            $entity->setCacheValue($value);
            $entity->setTtlSeconds($ttl);
            $entity->setScopeTag($this->extractScopeFromPrefix($prefix));

            $this->magicFlowCacheDomainService->saveCache($dataIsolation, $entity);

            return true;
        } catch (Exception $e) {
            $this->logger->error('MysqlStringCacheSetFailed', [
                'prefix' => $prefix,
                'key' => $key,
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    public function get(FlowDataIsolation $dataIsolation, string $prefix, string $key, string $default = ''): string
    {
        try {
            $entity = $this->magicFlowCacheDomainService->getCache($dataIsolation, $prefix, $key);

            return $entity ? $entity->getCacheValue() : $default;
        } catch (Exception $e) {
            $this->logger->error('MysqlStringCacheGetFailed', [
                'prefix' => $prefix,
                'key' => $key,
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'error' => $e->getMessage(),
            ]);
            return $default;
        }
    }

    public function del(FlowDataIsolation $dataIsolation, string $prefix, string $key): bool
    {
        try {
            return $this->magicFlowCacheDomainService->deleteCache($dataIsolation, $prefix, $key);
        } catch (Exception $e) {
            $this->logger->error('MysqlStringCacheDeleteFailed', [
                'prefix' => $prefix,
                'key' => $key,
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Extract scope tag from cache prefix.
     * Prefix format: {scope}_{identifier} (e.g., "user_12345", "topic_conv123_topic456", "agent_agent001").
     *
     * @param string $prefix The full cache prefix
     * @return string The scope tag (user, topic, agent)
     */
    private function extractScopeFromPrefix(string $prefix): string
    {
        $parts = explode('_', $prefix, 2);
        return $parts[0] ?? $prefix;
    }
}
