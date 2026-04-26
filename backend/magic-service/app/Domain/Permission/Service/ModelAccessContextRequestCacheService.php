<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Domain\Permission\Entity\ValueObject\ModelAccessContext;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use Hyperf\Context\Context;

/**
 * 模型访问上下文请求级缓存。
 *
 * 仅在当前请求/协程内生效；跨请求不共享，依赖每个请求自然冷启动。
 */
class ModelAccessContextRequestCacheService
{
    private const string CACHE_KEY_PREFIX = 'permission:model_access_context:local:';

    private const string VERSION_KEY_PREFIX = 'permission:model_access_context:version:';

    public function buildKey(PermissionDataIsolation $dataIsolation, string $userId): string
    {
        $payload = [
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'actor_user_id' => $dataIsolation->getCurrentUserId(),
            'subject_user_id' => $userId,
            'magic_id' => $dataIsolation->getMagicId(),
            'subscription_enabled' => $dataIsolation->getSubscriptionManager()->isEnabled(),
            'request_local_version' => $this->getOrganizationVersion($dataIsolation->getCurrentOrganizationCode()),
        ];

        $hash = md5((string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return self::CACHE_KEY_PREFIX . $hash;
    }

    public function get(string $cacheKey): ?ModelAccessContext
    {
        $context = Context::get($cacheKey);

        return $context instanceof ModelAccessContext ? $context : null;
    }

    public function put(string $cacheKey, ModelAccessContext $context): void
    {
        Context::set($cacheKey, $context);
    }

    public function clear(string $cacheKey): void
    {
        Context::destroy($cacheKey);
    }

    public function bumpOrganizationVersion(string $organizationCode): int
    {
        $version = $this->getOrganizationVersion($organizationCode) + 1;
        Context::set($this->buildOrganizationVersionKey($organizationCode), $version);

        return $version;
    }

    public function getOrganizationVersion(string $organizationCode): int
    {
        return max(1, (int) Context::get($this->buildOrganizationVersionKey($organizationCode), 1));
    }

    private function buildOrganizationVersionKey(string $organizationCode): string
    {
        return self::VERSION_KEY_PREFIX . $organizationCode;
    }
}
