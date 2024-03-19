<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\AudioMarkerEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\AudioMarkerRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\AudioMarkerModel;

class AudioMarkerRepository extends AbstractRepository implements AudioMarkerRepositoryInterface
{
    public function __construct(protected AudioMarkerModel $model)
    {
    }

    public function create(AudioMarkerEntity $entity): AudioMarkerEntity
    {
        $model = new $this->model();
        $model->fill($entity->toArray());
        $model->save();

        $entity->setId($model->id);
        return $entity;
    }

    public function update(AudioMarkerEntity $entity): bool
    {
        $model = $this->model::query()->find($entity->getId());
        if (! $model) {
            return false;
        }

        return $model->update($entity->toArray());
    }

    public function getById(int $id): ?AudioMarkerEntity
    {
        $model = $this->model::query()
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        return $this->modelToEntity($model);
    }

    public function getByProjectId(
        int $projectId,
        int $page = 1,
        int $pageSize = 20,
        string $orderBy = 'position_seconds',
        string $orderDirection = 'asc'
    ): array {
        $query = $this->model::query()
            ->where('project_id', $projectId)
            ->whereNull('deleted_at');

        $total = $query->count();

        $list = $query->orderBy($orderBy, $orderDirection)
            ->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        $entities = [];
        foreach ($list as $model) {
            $entities[] = $this->modelToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $entities,
        ];
    }

    public function getByProjectIdAndUserId(
        int $projectId,
        string $userId,
        int $page = 1,
        int $pageSize = 20,
        string $orderBy = 'position_seconds',
        string $orderDirection = 'asc'
    ): array {
        $query = $this->model::query()
            ->where('project_id', $projectId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at');

        $total = $query->count();

        $list = $query->orderBy($orderBy, $orderDirection)
            ->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        $entities = [];
        foreach ($list as $model) {
            $entities[] = $this->modelToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $entities,
        ];
    }

    public function delete(int $id): bool
    {
        return $this->model::query()
            ->where('id', $id)
            ->delete() > 0;
    }

    public function save(AudioMarkerEntity $entity): AudioMarkerEntity
    {
        if ($entity->getId()) {
            $model = $this->model::query()->find($entity->getId());
            if ($model) {
                $model->update($entity->toArray());
            }
        } else {
            $model = new $this->model();
            $model->fill($entity->toArray());
            $model->save();
            $entity->setId($model->id);
        }

        return $entity;
    }

    protected function modelToEntity($model): ?AudioMarkerEntity
    {
        if (! $model) {
            return null;
        }

        $entity = new AudioMarkerEntity();
        $entity->setId((int) $model->id);
        $entity->setProjectId((int) $model->project_id);
        $entity->setPositionSeconds((int) $model->position_seconds);
        $entity->setContent((string) $model->content);
        $entity->setUserId((string) $model->user_id);
        $entity->setUserOrganizationCode((string) $model->user_organization_code);
        $entity->setCreatedUid($model->created_uid ? (string) $model->created_uid : null);
        $entity->setUpdatedUid($model->updated_uid ? (string) $model->updated_uid : null);
        $entity->setCreatedAt($model->created_at ? (string) $model->created_at : null);
        $entity->setUpdatedAt($model->updated_at ? (string) $model->updated_at : null);
        $entity->setDeletedAt($model->deleted_at ? (string) $model->deleted_at : null);

        return $entity;
    }
}
