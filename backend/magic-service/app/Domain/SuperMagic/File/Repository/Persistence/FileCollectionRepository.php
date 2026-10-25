<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Repository\Persistence;

use App\Domain\SuperMagic\File\Entity\FileCollectionEntity;
use App\Domain\SuperMagic\File\Repository\Facade\FileCollectionRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Model\FileCollectionModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;

/**
 * 文件集仓储实现.
 */
class FileCollectionRepository extends AbstractRepository implements FileCollectionRepositoryInterface
{
    /**
     * 构造函数.
     */
    public function __construct(protected FileCollectionModel $model)
    {
    }

    /**
     * 通过ID获取文件集.
     */
    public function getById(int $id): ?FileCollectionEntity
    {
        $model = $this->model->newQuery()->where('id', $id)->whereNull('deleted_at')->first();
        return $model ? $this->modelToEntity($model) : null;
    }

    /**
     * 保存文件集实体.
     */
    public function save(FileCollectionEntity $entity): FileCollectionEntity
    {
        $data = $this->entityToArray($entity);

        if ($entity->getId() === 0) {
            $data['id'] = IdGenerator::getSnowId();
            $entity->setId((int) $data['id']);
        }

        $model = $this->model::query()->updateOrCreate(
            ['id' => $data['id']],
            $data
        );

        $entity->setId((int) $model->id);

        return $entity;
    }

    public function touch(int $id, string $updatedUid = ''): bool
    {
        $data = [
            'updated_at' => date('Y-m-d H:i:s'),
            'scope_version' => Db::raw('scope_version + 1'),
        ];
        if ($updatedUid !== '') {
            $data['updated_uid'] = $updatedUid;
        }
        return $this->model->newQuery()->where('id', $id)->update($data) > 0;
    }

    /**
     * 删除文件集.
     */
    public function delete(int $id, bool $forceDelete = false): bool
    {
        if ($forceDelete) {
            // 物理删除
            /** @phpstan-ignore-next-line - FileCollectionModel uses SoftDeletes trait which provides withTrashed() */
            $model = $this->model->newQuery()->withTrashed()->find($id);
            if ($model) {
                return $model->forceDelete();
            }
        } else {
            // 软删除
            $model = $this->model->newQuery()->find($id);
            if ($model) {
                return $model->delete();
            }
        }
        return false;
    }

    /**
     * 将PO模型转换为实体.
     */
    protected function modelToEntity(FileCollectionModel $model): ?FileCollectionEntity
    {
        $entity = new FileCollectionEntity();
        $entity->setId((int) $model->id);
        $entity->setCreatedUid((string) $model->created_uid);
        $entity->setUpdatedUid((string) $model->updated_uid);
        $entity->setOrganizationCode((string) $model->organization_code);

        if ($model->created_at) {
            $entity->setCreatedAt($model->created_at);
        }

        if ($model->updated_at) {
            $entity->setUpdatedAt($model->updated_at);
        }

        if ($model->deleted_at) {
            $entity->setDeletedAt($model->deleted_at);
        }
        $entity->setScopeVersion((int) ($model->scope_version ?? 1));

        return $entity;
    }

    /**
     * 将实体转换为数组.
     */
    protected function entityToArray(FileCollectionEntity $entity): array
    {
        return [
            'id' => $entity->getId(),
            'created_uid' => $entity->getCreatedUid(),
            'updated_uid' => $entity->getUpdatedUid(),
            'organization_code' => $entity->getOrganizationCode(),
            'created_at' => $entity->getCreatedAt(),
            'updated_at' => $entity->getUpdatedAt(),
            'deleted_at' => $entity->getDeletedAt(),
            'scope_version' => $entity->getScopeVersion(),
        ];
    }
}
