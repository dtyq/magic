<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Audit\Repository;

use App\Domain\Audit\Entity\AdminOperationLogEntity;
use App\Domain\Audit\Repository\Facade\AdminOperationLogRepositoryInterface;
use App\Infrastructure\Audit\Repository\Model\AdminOperationLogModel;
use App\Infrastructure\Core\ValueObject\Page;
use DateTime;

use function Hyperf\Support\now;

/**
 * 管理员操作日志仓库实现.
 */
class AdminOperationLogRepository implements AdminOperationLogRepositoryInterface
{
    public function save(string $organizationCode, AdminOperationLogEntity $entity): AdminOperationLogEntity
    {
        $data = [
            'organization_code' => $organizationCode,
            'user_id' => $entity->getUserId(),
            'user_name' => $entity->getUserName(),
            'resource_code' => $entity->getResourceCode(),
            'resource_label' => $entity->getResourceLabel(),
            'operation_code' => $entity->getOperationCode(),
            'operation_label' => $entity->getOperationLabel(),
            'operation_description' => $entity->getOperationDescription(),
            'ip' => $entity->getIp(),
            'request_url' => $entity->getRequestUrl(),
            'request_body' => $entity->getRequestBody(),
            'created_at' => $entity->getCreatedAt() ?? now(),
            'updated_at' => $entity->getUpdatedAt() ?? now(),
        ];

        $model = AdminOperationLogModel::create($data);
        $entity->setId($model->id);

        return $entity;
    }

    public function batchSave(string $organizationCode, array $entities): void
    {
        if (empty($entities)) {
            return;
        }

        $data = [];
        $createdAt = now();

        foreach ($entities as $entity) {
            $data[] = [
                'organization_code' => $organizationCode,
                'user_id' => $entity->getUserId(),
                'user_name' => $entity->getUserName(),
                'resource_code' => $entity->getResourceCode(),
                'resource_label' => $entity->getResourceLabel(),
                'operation_code' => $entity->getOperationCode(),
                'operation_label' => $entity->getOperationLabel(),
                'operation_description' => $entity->getOperationDescription(),
                'ip' => $entity->getIp(),
                'request_url' => $entity->getRequestUrl(),
                'request_body' => $entity->getRequestBody(),
                'created_at' => $entity->getCreatedAt() ?? $createdAt,
                'updated_at' => $entity->getUpdatedAt() ?? $createdAt,
            ];
        }

        // 批量插入，性能更好
        AdminOperationLogModel::insert($data);
    }

    public function getById(string $organizationCode, int $id): ?AdminOperationLogEntity
    {
        $model = $this->query($organizationCode)
            ->where('id', $id)
            ->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    public function queries(string $organizationCode, Page $page, ?array $filters = null): array
    {
        $query = $this->query($organizationCode);

        // 应用过滤条件
        if ($filters) {
            // 按用户ID过滤
            if (isset($filters['user_id']) && ! empty($filters['user_id'])) {
                $query->where('user_id', $filters['user_id']);
            }

            // 按操作人姓名模糊过滤
            if (isset($filters['user_name_like']) && $filters['user_name_like'] !== '') {
                $query->where('user_name', 'like', '%' . $filters['user_name_like'] . '%');
            }

            // 按资源代码过滤
            if (isset($filters['resource_code']) && ! empty($filters['resource_code'])) {
                $query->where('resource_code', $filters['resource_code']);
            }

            // 按操作代码过滤
            if (isset($filters['operation_code']) && ! empty($filters['operation_code'])) {
                $query->where('operation_code', $filters['operation_code']);
            }

            // 按时间范围过滤
            if (isset($filters['start_time']) && ! empty($filters['start_time'])) {
                $query->where('created_at', '>=', $filters['start_time']);
            }
            if (isset($filters['end_time']) && ! empty($filters['end_time'])) {
                $query->where('created_at', '<=', $filters['end_time']);
            }
        }

        // 获取总数
        $total = $query->count();

        // 分页查询，按时间倒序
        $models = $query->orderBy('created_at', 'desc')
            ->forPage($page->getPage(), $page->getPageNum())
            ->get();

        $logs = [];
        foreach ($models as $model) {
            $logs[] = $this->mapToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $logs,
        ];
    }

    private function query(string $organizationCode)
    {
        return AdminOperationLogModel::query()->where('organization_code', $organizationCode);
    }

    private function mapToEntity(AdminOperationLogModel $model): AdminOperationLogEntity
    {
        $entity = new AdminOperationLogEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code ?? null);
        $entity->setUserId($model->user_id ?? null);
        $entity->setUserName($model->user_name ?? null);
        $entity->setResourceCode($model->resource_code ?? null);
        $entity->setResourceLabel($model->resource_label ?? null);
        $entity->setOperationCode($model->operation_code ?? null);
        $entity->setOperationLabel($model->operation_label ?? null);
        $entity->setOperationDescription($model->operation_description ?? null);
        $entity->setIp($model->ip ?? null);
        $entity->setRequestUrl($model->request_url ?? null);
        $entity->setRequestBody($model->request_body ?? null);

        if ($model->created_at) {
            $entity->setCreatedAt(DateTime::createFromInterface($model->created_at));
        }

        if ($model->updated_at) {
            $entity->setUpdatedAt(DateTime::createFromInterface($model->updated_at));
        }

        return $entity;
    }
}
