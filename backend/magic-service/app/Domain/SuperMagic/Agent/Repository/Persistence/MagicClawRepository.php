<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Repository\Persistence;

use App\Domain\SuperMagic\Agent\Entity\MagicClawEntity;
use App\Domain\SuperMagic\Agent\Repository\Facade\MagicClawRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Persistence\Model\MagicClawModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

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

    public function getList(string $userId, string $organizationCode, int $page, int $pageSize, string $keyword = ''): array
    {
        $builder = $this->magicClawModel::query()
            ->where('user_id', $userId)
            ->where('organization_code', $organizationCode)
            ->orderByDesc('created_at');

        if ($keyword !== '') {
            $builder->where('name', 'like', '%' . $keyword . '%');
        }

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

    public function getAllValidList(int $page, int $pageSize): array
    {
        $builder = $this->magicClawModel::query()
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

    public function getByProjectId(int $projectId): ?MagicClawEntity
    {
        $model = $this->magicClawModel::query()
            ->where('project_id', $projectId)
            ->first();
        return $model ? $this->modelToEntity($model) : null;
    }

    public function getByProjectIds(array $projectIds): array
    {
        $projectIds = array_values(array_unique(array_filter(
            array_map('intval', $projectIds),
            static fn (int $projectId): bool => $projectId > 0
        )));
        if (empty($projectIds)) {
            return [];
        }

        $models = $this->magicClawModel::query()
            ->whereIn('project_id', $projectIds)
            ->get();

        $claws = [];
        foreach ($models as $model) {
            $entity = $this->modelToEntity($model);
            $projectId = $entity->getProjectId();
            if ($projectId !== null) {
                $claws[$projectId] = $entity;
            }
        }

        return $claws;
    }

    private function modelToEntity(MagicClawModel $model): MagicClawEntity
    {
        $entity = new MagicClawEntity();
        $entity->setId((int) $model->id);
        $entity->setCode((string) $model->code);
        $entity->setName((string) $model->name);
        $entity->setDescription((string) ($model->description ?? ''));
        $entity->setIcon((string) ($model->icon ?? ''));
        $entity->setTemplateCode((string) ($model->template_code ?? ''));
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
        $model->template_code = $entity->getTemplateCode();
        $model->organization_code = $entity->getOrganizationCode();
        $model->user_id = $entity->getUserId();
        $model->project_id = $entity->getProjectId();
        $model->created_uid = $entity->getCreatedUid();
        $model->updated_uid = $entity->getUpdatedUid();
    }
}
