<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectOperationLogEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectOperationLogRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\ProjectOperationLogModel;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

/**
 * 项目操作日志仓储实现.
 */
class ProjectOperationLogRepository extends AbstractRepository implements ProjectOperationLogRepositoryInterface
{
    public function __construct(
        protected ProjectOperationLogModel $operationLogModel
    ) {
    }

    /**
     * 保存操作日志.
     */
    public function save(ProjectOperationLogEntity $operationLog): ProjectOperationLogEntity
    {
        $attributes = $this->entityToModelAttributes($operationLog);

        if ($operationLog->getId() > 0) {
            // 更新现有记录
            $model = $this->operationLogModel::query()->find($operationLog->getId());
            if (! $model) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.operation_log.not_found');
            }
            $model->update($attributes);
            return $this->modelToEntity($model->toArray());
        }

        // 创建新记录
        $attributes['id'] = IdGenerator::getSnowId();
        $model = $this->operationLogModel::query()->create($attributes);
        return $this->modelToEntity($model->toArray());
    }

    /**
     * 根据项目ID查找操作日志列表.
     */
    public function findByProjectId(int $projectId, int $page = 1, int $pageSize = 20): array
    {
        $offset = ($page - 1) * $pageSize;

        $models = $this->operationLogModel::query()
            ->where('project_id', $projectId)
            ->orderBy('created_at', 'desc')
            ->offset($offset)
            ->limit($pageSize)
            ->get();

        return $models->map(function ($model) {
            return $this->modelToEntity($model->toArray());
        })->toArray();
    }

    /**
     * 根据项目和用户查找操作日志.
     */
    public function findByProjectAndUser(int $projectId, string $userId, int $page = 1, int $pageSize = 20): array
    {
        $offset = ($page - 1) * $pageSize;

        $models = $this->operationLogModel::query()
            ->where('project_id', $projectId)
            ->where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->offset($offset)
            ->limit($pageSize)
            ->get();

        return $models->map(function ($model) {
            return $this->modelToEntity($model->toArray());
        })->toArray();
    }

    /**
     * 根据项目和操作类型查找日志.
     */
    public function findByProjectAndAction(int $projectId, string $action, int $page = 1, int $pageSize = 20): array
    {
        $offset = ($page - 1) * $pageSize;

        $models = $this->operationLogModel::query()
            ->where('project_id', $projectId)
            ->where('operation_action', $action)
            ->orderBy('created_at', 'desc')
            ->offset($offset)
            ->limit($pageSize)
            ->get()->toArray();

        return array_map(function ($model) {
            return $this->modelToEntity($model);
        }, $models);
    }

    /**
     * 根据项目ID统计操作日志数量.
     */
    public function countByProjectId(int $projectId): int
    {
        return $this->operationLogModel::query()
            ->where('project_id', $projectId)
            ->count();
    }

    /**
     * 根据组织编码查找操作日志.
     */
    public function findByOrganization(string $organizationCode, int $page = 1, int $pageSize = 20): array
    {
        $offset = ($page - 1) * $pageSize;

        $models = $this->operationLogModel::query()
            ->where('organization_code', $organizationCode)
            ->orderBy('created_at', 'desc')
            ->offset($offset)
            ->limit($pageSize)
            ->get();

        return $models->map(function ($model) {
            return $this->modelToEntity($model->toArray());
        })->toArray();
    }

    /**
     * 将实体转换为模型属性.
     */
    protected function entityToModelAttributes(ProjectOperationLogEntity $entity): array
    {
        return [
            'project_id' => $entity->getProjectId(),
            'user_id' => $entity->getUserId(),
            'organization_code' => $entity->getOrganizationCode(),
            'operation_action' => $entity->getOperationAction(),
            'resource_type' => $entity->getResourceType(),
            'resource_id' => $entity->getResourceId(),
            'resource_name' => $entity->getResourceName(),
            'operation_details' => $entity->getOperationDetails(),
            'operation_status' => $entity->getOperationStatus(),
            'ip_address' => $entity->getIpAddress(),
        ];
    }

    /**
     * 将模型数据转换为实体.
     */
    protected function modelToEntity(array $data): ProjectOperationLogEntity
    {
        $entity = new ProjectOperationLogEntity();
        $entity->setId($data['id'] ?? 0)
            ->setProjectId($data['project_id'] ?? 0)
            ->setUserId($data['user_id'] ?? '')
            ->setOrganizationCode($data['organization_code'] ?? '')
            ->setOperationAction($data['operation_action'] ?? '')
            ->setResourceType($data['resource_type'] ?? '')
            ->setResourceId($data['resource_id'] ?? '')
            ->setResourceName($data['resource_name'] ?? '')
            ->setOperationDetails($data['operation_details'] ?? [])
            ->setOperationStatus($data['operation_status'] ?? 'success')
            ->setIpAddress($data['ip_address'] ?? '')
            ->setCreatedAt($data['created_at'] ?? '')
            ->setUpdatedAt($data['updated_at'] ?? '');

        return $entity;
    }
}
