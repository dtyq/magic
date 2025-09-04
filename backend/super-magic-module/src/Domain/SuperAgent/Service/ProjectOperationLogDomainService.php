<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectOperationLogEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectOperationLogRepositoryInterface;

/**
 * 项目操作日志领域服务
 */
class ProjectOperationLogDomainService
{
    public function __construct(
        private readonly ProjectOperationLogRepositoryInterface $projectOperationLogRepository
    ) {
    }

    /**
     * 保存操作日志.
     */
    public function saveOperationLog(ProjectOperationLogEntity $operationLog): ProjectOperationLogEntity
    {
        return $this->projectOperationLogRepository->save($operationLog);
    }

    /**
     * 获取项目操作日志列表.
     */
    public function getProjectOperationLogs(int $projectId, int $page = 1, int $pageSize = 20): array
    {
        return $this->projectOperationLogRepository->findByProjectId($projectId, $page, $pageSize);
    }

    /**
     * 根据项目和用户获取操作日志.
     */
    public function getProjectUserOperationLogs(int $projectId, string $userId, int $page = 1, int $pageSize = 20): array
    {
        return $this->projectOperationLogRepository->findByProjectAndUser($projectId, $userId, $page, $pageSize);
    }

    /**
     * 根据项目和操作类型获取日志.
     * @return ProjectOperationLogEntity[]
     */
    public function getProjectActionOperationLogs(int $projectId, string $action, int $page = 1, int $pageSize = 20): array
    {
        return $this->projectOperationLogRepository->findByProjectAndAction($projectId, $action, $page, $pageSize);
    }

    /**
     * 统计项目操作日志数量.
     */
    public function countProjectOperationLogs(int $projectId): int
    {
        return $this->projectOperationLogRepository->countByProjectId($projectId);
    }

    /**
     * 根据组织编码获取操作日志.
     */
    public function getOrganizationOperationLogs(string $organizationCode, int $page = 1, int $pageSize = 20): array
    {
        return $this->projectOperationLogRepository->findByOrganization($organizationCode, $page, $pageSize);
    }
}
