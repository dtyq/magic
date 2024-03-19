<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Repository\Persistence;

use App\Domain\File\Constant\DefaultFileBusinessType;
use App\Domain\File\Constant\DefaultFileType;
use App\Domain\File\Entity\DefaultFileEntity;
use App\Domain\File\Factory\DefaultFileEntityFactory;
use App\Domain\File\Repository\Persistence\Model\DefaultFileModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;

class DefaultFileRepository
{
    public function __construct(protected DefaultFileModel $defaultFileModel)
    {
    }

    /**
     * @return DefaultFileEntity[]
     */
    public function getDefault(DefaultFileBusinessType $defaultFileBusiness): array
    {
        $query = $this->defaultFileModel::query()->where('business_type', $defaultFileBusiness->value)->where('file_type', DefaultFileType::DEFAULT->value);
        $result = Db::select($query->toSql(), $query->getBindings());
        return DefaultFileEntityFactory::toEntities($result);
    }

    /**
     * 插入.
     */
    public function insert(DefaultFileEntity $defaultFileEntity): DefaultFileEntity
    {
        $date = date('Y-m-d H:i:s');
        $defaultFileEntity->setId(IdGenerator::getSnowId());
        $defaultFileEntity->setCreatedAt($date);
        $defaultFileEntity->setUpdatedAt($date);
        $this->defaultFileModel::query()->create($defaultFileEntity->toArray());
        return $defaultFileEntity;
    }

    /**
     * 获取文件.
     * @return DefaultFileEntity[]
     */
    public function getByOrganizationCodeAndBusinessType(DefaultFileBusinessType $defaultFileBusiness, string $organizationCode): array
    {
        $query = $this->defaultFileModel::query()->where('business_type', $defaultFileBusiness->value)->where('organization', $organizationCode);
        $result = Db::select($query->toSql(), $query->getBindings());
        return DefaultFileEntityFactory::toEntities($result);
    }

    public function getOnePublicUrl(DefaultFileBusinessType $businessType): string
    {
        $query = $this->defaultFileModel::query()->where('business_type', $businessType->value)->where('file_type', DefaultFileType::DEFAULT->value)->select('key');
        $result = Db::select($query->toSql(), $query->getBindings());
        $entity = DefaultFileEntityFactory::toEntity($result[0]);
        return $entity->getKey();
    }

    public function getByKey(string $key): ?DefaultFileEntity
    {
        $result = $this->defaultFileModel::query()
            ->where('key', $key)
            ->first();

        if (! $result) {
            return null;
        }

        return DefaultFileEntityFactory::toEntity($result->toArray());
    }

    public function getByKeyAndBusinessType(string $key, string $businessType, string $organizationCode): ?DefaultFileEntity
    {
        $result = $this->defaultFileModel::query()
            ->where('key', $key)
            ->where('business_type', $businessType)
            ->where('organization', $organizationCode)
            ->first();

        if (! $result) {
            return null;
        }

        return DefaultFileEntityFactory::toEntity($result->toArray());
    }

    public function deleteByKey(string $key, string $organizationCode): bool
    {
        return $this->defaultFileModel::query()
            ->where('key', $key)
            ->where('organization', $organizationCode)
            ->delete() > 0;
    }
}
