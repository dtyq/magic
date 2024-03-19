<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TransferLogEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TransferStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TransferType;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TransferLogRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TransferLogModel;

/**
 * Transfer log repository implementation.
 */
class TransferLogRepository extends AbstractRepository implements TransferLogRepositoryInterface
{
    public function __construct(
        protected TransferLogModel $transferLogModel
    ) {
    }

    /**
     * Save transfer log entity.
     */
    public function save(TransferLogEntity $logEntity): TransferLogEntity
    {
        $attributes = $this->entityToModelAttributes($logEntity);

        if ($logEntity->getId() > 0) {
            // Update existing record
            $model = $this->transferLogModel::query()->find($logEntity->getId());
            if ($model) {
                $model->update($attributes);
                return $this->modelToEntity($model->toArray());
            }
        }

        // Create new record
        $attributes['id'] = IdGenerator::getSnowId();
        $model = $this->transferLogModel::query()->create($attributes);
        return $this->modelToEntity($model->toArray());
    }

    /**
     * Find transfer log by ID.
     */
    public function findById(int $id): ?TransferLogEntity
    {
        $model = $this->transferLogModel::query()->find($id);
        if (! $model) {
            return null;
        }
        return $this->modelToEntity($model->toArray());
    }

    /**
     * Find transfer logs by batch ID.
     */
    public function findByBatchId(string $batchId): array
    {
        $models = $this->transferLogModel::query()
            ->where('batch_id', $batchId)
            ->orderBy('created_at', 'desc')
            ->get();

        return $models->map(function ($model) {
            return $this->modelToEntity($model->toArray());
        })->toArray();
    }

    /**
     * Find transfer logs by user ID (as sender or receiver).
     */
    public function findByUserId(string $userId, int $page = 1, int $pageSize = 20): array
    {
        $offset = ($page - 1) * $pageSize;

        $models = $this->transferLogModel::query()
            ->where(function ($query) use ($userId) {
                $query->where('from_user_id', $userId)
                    ->orWhere('to_user_id', $userId);
            })
            ->orderBy('created_at', 'desc')
            ->offset($offset)
            ->limit($pageSize)
            ->get();

        return $models->map(function ($model) {
            return $this->modelToEntity($model->toArray());
        })->toArray();
    }

    /**
     * Find transfer logs by organization code.
     */
    public function findByOrganization(string $organizationCode, int $page = 1, int $pageSize = 20): array
    {
        $offset = ($page - 1) * $pageSize;

        $models = $this->transferLogModel::query()
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
     * Count transfer logs by user ID.
     */
    public function countByUserId(string $userId): int
    {
        return $this->transferLogModel::query()
            ->where(function ($query) use ($userId) {
                $query->where('from_user_id', $userId)
                    ->orWhere('to_user_id', $userId);
            })
            ->count();
    }

    /**
     * Convert entity to model attributes.
     */
    protected function entityToModelAttributes(TransferLogEntity $entity): array
    {
        return [
            'batch_id' => $entity->getBatchId(),
            'organization_code' => $entity->getOrganizationCode(),
            'transfer_type' => $entity->getTransferType()->value,
            'resource_id' => $entity->getResourceId(),
            'resource_name' => $entity->getResourceName(),
            'from_user_id' => $entity->getFromUserId(),
            'to_user_id' => $entity->getToUserId(),
            'share_to_original' => $entity->isShareToOriginal() ? 1 : 0,
            'share_role' => $entity->getShareRole(),
            'projects_count' => $entity->getProjectsCount(),
            'files_count' => $entity->getFilesCount(),
            'status' => $entity->getStatus()->value,
            'error_message' => $entity->getErrorMessage(),
            'extra' => $entity->getExtra(),
        ];
    }

    /**
     * Convert model data to entity.
     */
    protected function modelToEntity(array $data): TransferLogEntity
    {
        $entity = new TransferLogEntity();
        $entity->setId($data['id'] ?? 0)
            ->setBatchId($data['batch_id'] ?? '')
            ->setOrganizationCode($data['organization_code'] ?? '')
            ->setTransferType(TransferType::from($data['transfer_type'] ?? 2))
            ->setResourceId($data['resource_id'] ?? 0)
            ->setResourceName($data['resource_name'] ?? '')
            ->setFromUserId($data['from_user_id'] ?? '')
            ->setToUserId($data['to_user_id'] ?? '')
            ->setShareToOriginal((bool) ($data['share_to_original'] ?? false))
            ->setShareRole($data['share_role'] ?? '')
            ->setProjectsCount($data['projects_count'] ?? 0)
            ->setFilesCount($data['files_count'] ?? 0)
            ->setStatus(TransferStatus::from($data['status'] ?? 0))
            ->setErrorMessage($data['error_message'] ?? null)
            ->setExtra($data['extra'] ?? [])
            ->setCreatedAt($data['created_at'] ?? null)
            ->setUpdatedAt($data['updated_at'] ?? null);

        return $entity;
    }
}
