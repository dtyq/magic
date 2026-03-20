<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Agent\Entity\MagicClawEntity;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\MagicClawRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\MagicClawModel;

class MagicClawRepository extends SuperMagicAbstractRepository implements MagicClawRepositoryInterface
{
    public function __construct(public MagicClawModel $magicClawModel)
    {
    }

    public function create(MagicClawEntity $entity): MagicClawEntity
    {
        $id = IdGenerator::getSnowId();
        $entity->setId($id);

        $model = new MagicClawModel();
        $model->id = $id;
        $this->fillModel($model, $entity);
        $model->save();
        return $entity;
    }

    public function save(MagicClawEntity $entity): MagicClawEntity
    {
        /** @var null|MagicClawModel $model */
        $model = $this->magicClawModel::query()
            ->where('id', $entity->getId())
            ->first();

        if (! $model) {
            return $this->create($entity);
        }

        $this->fillModel($model, $entity);
        $model->save();
        return $entity;
    }

    public function findByCode(string $code, string $userId, string $organizationCode): ?MagicClawEntity
    {
        /** @var null|MagicClawModel $model */
        $model = $this->magicClawModel::query()
            ->where('code', $code)
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->first();

        if (! $model) {
            return null;
        }

        return $this->modelToEntity($model);
    }

    public function delete(MagicClawEntity $entity): bool
    {
        return (bool) $this->magicClawModel::query()
            ->where('id', $entity->getId())
            ->delete();
    }

    public function getList(string $userId, string $organizationCode, int $page, int $pageSize): array
    {
        $builder = $this->magicClawModel::query()
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->orderByDesc('created_at');

        $total = $builder->count();

        if ($total === 0) {
            return ['total' => 0, 'list' => []];
        }

        $models = $builder->forPage($page, $pageSize)->get();

        $list = [];
        foreach ($models as $model) {
            $list[] = $this->modelToEntity($model);
        }

        return ['total' => $total, 'list' => $list];
    }

    public function updateProjectId(int $id, int $projectId): bool
    {
        return (bool) $this->magicClawModel::query()
            ->where('id', $id)
            ->update(['project_id' => $projectId]);
    }

    private function modelToEntity(MagicClawModel $model): MagicClawEntity
    {
        $entity = new MagicClawEntity();
        $entity->setId((int) $model->id);
        $entity->setCode((string) $model->code);
        $entity->setName((string) $model->name);
        $entity->setDescription((string) ($model->description ?? ''));
        $entity->setIcon((string) ($model->icon ?? ''));
        $entity->setOrganizationCode((string) $model->organization_code);
        $entity->setUserId((string) $model->user_id);
        $entity->setProjectId($model->project_id !== null ? (int) $model->project_id : null);
        $entity->setCreatedUid((string) ($model->created_uid ?? ''));
        $entity->setUpdatedUid((string) ($model->updated_uid ?? ''));
        $entity->setCreatedAt($model->created_at?->toDateTimeString());
        $entity->setUpdatedAt($model->updated_at?->toDateTimeString());
        return $entity;
    }

    private function fillModel(MagicClawModel $model, MagicClawEntity $entity): void
    {
        $model->code = $entity->getCode();
        $model->name = $entity->getName();
        $model->description = $entity->getDescription();
        $model->icon = $entity->getIcon();
        $model->organization_code = $entity->getOrganizationCode();
        $model->user_id = $entity->getUserId();
        $model->project_id = $entity->getProjectId();
        $model->created_uid = $entity->getCreatedUid();
        $model->updated_uid = $entity->getUpdatedUid();
    }
}
