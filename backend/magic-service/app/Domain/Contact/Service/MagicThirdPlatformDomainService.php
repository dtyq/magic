<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Service;

use App\Domain\Chat\Repository\Facade\MagicContactIdMappingRepositoryInterface;
use App\Domain\Contact\Entity\MagicThirdPlatformIdMappingEntity;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * 第三方联系人映射查询及用户 ID 解析。
 */
readonly class MagicThirdPlatformDomainService
{
    private LoggerInterface $logger;

    /**
     * 注入联系人映射与日志依赖，不调用其他领域服务。
     */
    public function __construct(
        private MagicContactIdMappingRepositoryInterface $thirdPlatformRepository,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('third_platform_user');
    }

    /**
     * 获取第三方部门映射，保持既有查询行为。
     *
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function getThirdDepartments(
        array $currentDepartmentIds,
        string $magicOrganizationCode,
        PlatformType $thirdPlatformType
    ): array {
        return $this->thirdPlatformRepository->getThirdDepartments($currentDepartmentIds, $magicOrganizationCode, $thirdPlatformType);
    }

    /**
     * 在调用方确定的来源范围内返回首个非空用户 ID，多候选时记录告警。
     */
    public function resolveUserId(
        MagicEnvironmentEntity $environment,
        string $magicId,
        string $organizationCode,
        PlatformType $platformType
    ): string {
        $mappings = $this->thirdPlatformRepository->getScopedUserIdsMapping($environment, $magicId, $organizationCode, $platformType);

        $originIds = array_values(array_unique(array_filter(
            array_map(static fn (MagicThirdPlatformIdMappingEntity $mapping): string => $mapping->getOriginId(), $mappings),
            static fn (string $id): bool => $id !== '',
        ), SORT_STRING));
        if (count($originIds) > 1) {
            $this->logger->warning('第三方用户映射存在歧义', ['reason' => 'mapping_ambiguous', 'candidate_count' => count($originIds)]);
        }
        return $originIds[0] ?? '';
    }
}
