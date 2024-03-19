<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Facade;

use App\Domain\Contact\Entity\MagicThirdPlatformIdMappingEntity;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\Contact\Entity\ValueObject\ThirdPlatformIdMappingType;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;

interface MagicContactIdMappingRepositoryInterface
{
    /**
     * 获取第三方平台部门ID的映射关系.
     *
     * @param string[] $thirdDepartmentIds
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function getThirdDepartmentIdsMapping(
        MagicEnvironmentEntity $magicEnvironmentEntity,
        array $thirdDepartmentIds,
        string $magicOrganizationCode,
        PlatformType $thirdPlatformType
    ): array;

    /**
     * 获取第三方平台用户ID的映射关系.
     *
     * @param string[] $thirdUserIds
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function getThirdUserIdsMapping(
        MagicEnvironmentEntity $magicEnvironmentEntity,
        array $thirdUserIds,
        ?string $magicOrganizationCode,
        PlatformType $thirdPlatformType
    ): array;

    /**
     * 获取麦吉平台用户ID的映射关系.
     *
     * @param string[] $magicIds
     */
    public function getMagicIdsMapping(
        array $magicIds,
        ?string $magicOrganizationCode,
        PlatformType $thirdPlatformType
    ): array;

    /**
     * @param MagicThirdPlatformIdMappingEntity[] $thirdPlatformIdMappingEntities
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function createThirdPlatformIdsMapping(array $thirdPlatformIdMappingEntities): array;

    /**
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function getThirdDepartments(
        array $currentDepartmentIds,
        string $magicOrganizationCode,
        PlatformType $thirdPlatformType
    ): array;

    public function getDepartmentRootId(string $magicOrganizationCode, PlatformType $platformType): string;

    /**
     * 获取Magic部门ID的映射关系.
     */
    public function getMagicDepartmentIdsMapping(
        array $magicDepartmentIds,
        string $magicOrganizationCode,
        PlatformType $thirdPlatformType
    ): array;

    public function updateMappingEnvId(int $envId): int;

    /**
     * 根据 origin_id 批量软删除第三方平台映射记录。
     *
     * @param string[] $originIds 第三方平台的原始ID列表
     */
    public function deleteThirdPlatformIdsMapping(
        array $originIds,
        string $magicOrganizationCode,
        PlatformType $thirdPlatformType,
        ThirdPlatformIdMappingType $mappingType
    ): int;
}
