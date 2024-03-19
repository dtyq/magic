<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\Service;

use App\Domain\Audit\Entity\AdminOperationLogEntity;
use App\Domain\Audit\Repository\Facade\AdminOperationLogRepositoryInterface;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;
use Throwable;

/**
 * 管理员操作日志领域服务.
 */
readonly class AdminOperationLogDomainService
{
    public function __construct(
        private AdminOperationLogRepositoryInterface $repository
    ) {
    }

    /**
     * 保存操作日志.
     * 静默处理异常，不影响业务流程.
     */
    public function save(PermissionDataIsolation $dataIsolation, AdminOperationLogEntity $entity): ?AdminOperationLogEntity
    {
        try {
            $organizationCode = $dataIsolation->getCurrentOrganizationCode();
            $entity->prepareForCreation();

            return $this->repository->save($organizationCode, $entity);
        } catch (Throwable $e) {
            // 关键：领域服务层也要保证不抛出异常
            // 静默处理，返回 null 表示保存失败
            return null;
        }
    }

    /**
     * 批量保存操作日志.
     * 静默处理异常，不影响业务流程.
     */
    public function batchSave(PermissionDataIsolation $dataIsolation, array $entities): void
    {
        try {
            if (empty($entities)) {
                return;
            }

            $organizationCode = $dataIsolation->getCurrentOrganizationCode();

            foreach ($entities as $entity) {
                $entity->prepareForCreation();
            }

            $this->repository->batchSave($organizationCode, $entities);
        } catch (Throwable $e) {
            // 关键：批量保存失败也不能影响业务
            // 静默处理
        }
    }

    /**
     * 根据ID获取操作日志.
     */
    public function getById(PermissionDataIsolation $dataIsolation, int $id): ?AdminOperationLogEntity
    {
        return $this->repository->getById($dataIsolation->getCurrentOrganizationCode(), $id);
    }

    /**
     * 查询操作日志列表.
     * @return array{total: int, list: AdminOperationLogEntity[]}
     */
    public function queries(PermissionDataIsolation $dataIsolation, Page $page, ?array $filters = null): array
    {
        return $this->repository->queries($dataIsolation->getCurrentOrganizationCode(), $page, $filters);
    }
}
