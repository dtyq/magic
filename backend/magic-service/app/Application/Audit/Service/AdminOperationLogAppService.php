<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Audit\Entity\AdminOperationLogEntity;
use App\Domain\Audit\Service\AdminOperationLogDomainService;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * 管理员操作日志应用服务.
 */
class AdminOperationLogAppService extends AbstractKernelAppService
{
    public function __construct(
        private readonly AdminOperationLogDomainService $domainService
    ) {
    }

    /**
     * 保存操作日志.
     */
    public function save(PermissionDataIsolation $dataIsolation, AdminOperationLogEntity $entity): ?AdminOperationLogEntity
    {
        return $this->domainService->save($dataIsolation, $entity);
    }

    /**
     * 批量保存操作日志.
     */
    public function batchSave(PermissionDataIsolation $dataIsolation, array $entities): void
    {
        $this->domainService->batchSave($dataIsolation, $entities);
    }

    /**
     * 根据ID获取操作日志.
     */
    public function getById(PermissionDataIsolation $dataIsolation, int $id): ?AdminOperationLogEntity
    {
        return $this->domainService->getById($dataIsolation, $id);
    }

    /**
     * 查询操作日志列表.
     * @return array{total: int, list: AdminOperationLogEntity[]}
     */
    public function queries(PermissionDataIsolation $dataIsolation, Page $page, ?array $filters = null): array
    {
        return $this->domainService->queries($dataIsolation, $page, $filters);
    }

    /**
     * 以当前登录身份查询操作日志列表（需具备操作日志-查询权限，由 Facade 层鉴权注解校验）.
     * @return array{total: int, list: AdminOperationLogEntity[], page: int, pageSize: int}
     */
    public function queriesByAuthorization(Authenticatable $authorization, int $page, int $pageSize, ?array $filters = null): array
    {
        $dataIsolation = $this->createPermissionDataIsolation($authorization);
        $pageObj = new Page($page, $pageSize);
        $result = $this->domainService->queries($dataIsolation, $pageObj, $filters);

        return [
            'total' => $result['total'],
            'list' => $result['list'],
            'page' => $page,
            'pageSize' => $pageSize,
        ];
    }

    /**
     * 以当前登录身份获取操作日志详情（需具备操作日志-查询权限，由 Facade 层鉴权注解校验）.
     */
    public function getByIdByAuthorization(Authenticatable $authorization, int $id): ?AdminOperationLogEntity
    {
        $dataIsolation = $this->createPermissionDataIsolation($authorization);

        return $this->domainService->getById($dataIsolation, $id);
    }
}
