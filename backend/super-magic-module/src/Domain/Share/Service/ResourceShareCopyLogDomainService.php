<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Service;

use Dtyq\SuperMagic\Domain\Share\Repository\Facade\ResourceShareCopyLogRepositoryInterface;

/**
 * 分享复制日志领域服务.
 */
class ResourceShareCopyLogDomainService
{
    public function __construct(
        protected ResourceShareCopyLogRepositoryInterface $copyLogRepository
    ) {
    }

    /**
     * 获取分享的复制统计信息.
     *
     * @param int $sourceProjectId 源项目ID（分享关联的项目ID）
     * @param string $shareOrganizationCode 分享的组织代码（用于判断用户类型）
     * @param null|string $startDate 开始日期（格式：Y-m-d），为null则不限
     * @param null|string $endDate 结束日期（格式：Y-m-d），为null则不限
     * @param null|string $userType 用户类型（guest/team_member），为null则不限
     * @param bool $includeDeletedProjects 是否包含已删除项目的复制记录，默认false（不包含）
     * @return array 统计信息
     */
    public function getCopyStatistics(
        int $sourceProjectId,
        string $shareOrganizationCode,
        ?string $startDate = null,
        ?string $endDate = null,
        ?string $userType = null,
        bool $includeDeletedProjects = false
    ): array {
        return $this->copyLogRepository->getCopyStatistics(
            $sourceProjectId,
            $shareOrganizationCode,
            $startDate,
            $endDate,
            $userType,
            $includeDeletedProjects
        );
    }

    /**
     * 获取分享的复制日志列表.
     *
     * @param int $sourceProjectId 源项目ID（分享关联的项目ID）
     * @param string $shareOrganizationCode 分享的组织代码（用于判断用户类型）
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @param null|string $startDate 开始日期（格式：Y-m-d），为null则不限
     * @param null|string $endDate 结束日期（格式：Y-m-d），为null则不限
     * @param null|string $userType 用户类型（guest/team_member），为null则不限
     * @param bool $includeDeletedProjects 是否包含已删除项目的复制记录，默认false（不包含）
     * @return array 包含 total 和 list 的数组
     */
    public function getCopyLogs(
        int $sourceProjectId,
        string $shareOrganizationCode,
        int $page = 1,
        int $pageSize = 20,
        ?string $startDate = null,
        ?string $endDate = null,
        ?string $userType = null,
        bool $includeDeletedProjects = false
    ): array {
        return $this->copyLogRepository->getCopyLogs(
            $sourceProjectId,
            $shareOrganizationCode,
            $page,
            $pageSize,
            $startDate,
            $endDate,
            $userType,
            $includeDeletedProjects
        );
    }
}
