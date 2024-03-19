<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Util\Context\CoContext;
use InvalidArgumentException;

/**
 * DataIsolation serializer for serialization and deserialization.
 * Handles conversion between BaseDataIsolation objects and arrays,
 * and reinitializes environment after deserialization.
 */
class DataIsolationSerializer
{
    /**
     * Convert BaseDataIsolation to array for serialization.
     *
     * @return array<string, mixed>
     */
    public static function toArray(BaseDataIsolation $dataIsolation): array
    {
        return [
            'current_organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'current_user_id' => $dataIsolation->getCurrentUserId(),
            'magic_id' => $dataIsolation->getMagicId(),
            'env_id' => $dataIsolation->getEnvId(),
            'enabled' => $dataIsolation->isEnable(),
            'third_platform_user_id' => $dataIsolation->getThirdPlatformUserId(),
            'third_platform_organization_code' => $dataIsolation->getThirdPlatformOrganizationCode(),
            'contain_official_organization' => $dataIsolation->isContainOfficialOrganization(),
            'only_official_organization' => $dataIsolation->isOnlyOfficialOrganization(),
            'official_organization_codes' => $dataIsolation->getOfficialOrganizationCodes(),
            'language' => $dataIsolation->getLanguage(),
        ];
    }

    /**
     * Create BaseDataIsolation from array and reinitialize environment.
     *
     * @param array<string, mixed> $data
     * @param class-string<BaseDataIsolation> $className
     */
    public static function fromArray(array $data, string $className): BaseDataIsolation
    {
        if (! is_subclass_of($className, BaseDataIsolation::class)) {
            throw new InvalidArgumentException("Class {$className} must extend BaseDataIsolation");
        }

        /* @phpstan-ignore-next-line */
        $instance = new $className(
            $data['current_organization_code'] ?? '',
            $data['current_user_id'] ?? '',
            $data['magic_id'] ?? ''
        );

        // Use array_key_exists to handle false and 0 values correctly
        if (array_key_exists('env_id', $data)) {
            $instance->setEnvId($data['env_id']);
        }
        if (array_key_exists('enabled', $data)) {
            $instance->setEnabled($data['enabled']);
        }
        if (array_key_exists('third_platform_user_id', $data)) {
            $instance->setThirdPlatformUserId($data['third_platform_user_id']);
        }
        if (array_key_exists('third_platform_organization_code', $data)) {
            $instance->setThirdPlatformOrganizationCode($data['third_platform_organization_code']);
        }
        if (array_key_exists('contain_official_organization', $data)) {
            $instance->setContainOfficialOrganization($data['contain_official_organization']);
        }
        if (array_key_exists('only_official_organization', $data)) {
            $instance->setOnlyOfficialOrganization($data['only_official_organization']);
        }
        if (array_key_exists('official_organization_codes', $data)) {
            $instance->setOfficialOrganizationCodes($data['official_organization_codes']);
        }

        // Restore language to CoContext for cross-coroutine support
        if (array_key_exists('language', $data) && ! empty($data['language'])) {
            CoContext::setLanguage($data['language']);
        }

        // Reinitialize environment after deserialization
        $envId = $instance->getEnvId();
        EnvManager::initDataIsolationEnv($instance, $envId);

        return $instance;
    }
}
