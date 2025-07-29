<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\Entity\ValueObject\PlatformRootDepartmentId;
use App\Domain\Chat\Repository\Facade\MagicContactIdMappingRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\Model\MagicContactThirdPlatformIdMappingModel;
use App\Domain\Contact\Entity\MagicThirdPlatformIdMappingEntity;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\Contact\Entity\ValueObject\ThirdPlatformIdMappingType;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;

class MagicContactIdMappingRepository implements MagicContactIdMappingRepositoryInterface
{
    public function __construct(
        protected MagicContactThirdPlatformIdMappingModel $magicContactIdMappingModel
    ) {
    }

    /**
     * 获取第三方平台部门ID的映射关系.
     *
     * @param string[] $thirdDepartmentIds
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function getThirdDepartmentIdsMapping(
        MagicEnvironmentEntity $magicEnvironmentEntity,
        array $thirdDepartmentIds,
        string $magicOrganizationCode,
        PlatformType $thirdPlatformType
    ): array {
        $relationEnvIds = $this->getEnvRelationIds($magicEnvironmentEntity);
        $data = $this->magicContactIdMappingModel::query();

        // 保持原有的查询字段顺序
        // 根据环境ID数量选择合适的查询方式
        if (count($relationEnvIds) === 1) {
            $data->where('magic_environment_id', reset($relationEnvIds));
        } else {
            $data->whereIn('magic_environment_id', $relationEnvIds);
        }

        if (count($thirdDepartmentIds) > 0) {
            $data->whereIn('origin_id', $thirdDepartmentIds);
        }

        $data->where('mapping_type', ThirdPlatformIdMappingType::Department->value)
            ->where('third_platform_type', $thirdPlatformType->value)
            ->where('magic_organization_code', $magicOrganizationCode);

        $data = Db::select($data->toSql(), $data->getBindings());
        $thirdPlatformIdMappingEntities = [];
        foreach ($data as $item) {
            $thirdPlatformIdMappingEntities[] = new MagicThirdPlatformIdMappingEntity($item);
        }
        return $thirdPlatformIdMappingEntities;
    }

    /**
     * 获取Magic部门ID的映射关系.
     *
     * @param string[] $magicDepartmentIds
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function getMagicDepartmentIdsMapping(
        array $magicDepartmentIds,
        string $magicOrganizationCode,
        PlatformType $thirdPlatformType
    ): array {
        $data = $this->magicContactIdMappingModel::query()
            ->whereIn('new_id', $magicDepartmentIds)
            ->where('mapping_type', ThirdPlatformIdMappingType::Department->value)
            ->where('magic_organization_code', $magicOrganizationCode)
            ->where('third_platform_type', $thirdPlatformType->value);
        $data = Db::select($data->toSql(), $data->getBindings());
        $thirdPlatformIdMappingEntities = [];
        foreach ($data as $item) {
            $thirdPlatformIdMappingEntities[] = new MagicThirdPlatformIdMappingEntity($item);
        }
        return $thirdPlatformIdMappingEntities;
    }

    /**
     * 获取第三方平台用户ID的映射关系.
     *
     * @param string[] $thirdUserIds
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function getThirdUserIdsMapping(
        MagicEnvironmentEntity $magicEnvironmentEntity,
        array $thirdUserIds,
        ?string $magicOrganizationCode,
        PlatformType $thirdPlatformType
    ): array {
        $relationEnvIds = $this->getEnvRelationIds($magicEnvironmentEntity);
        $query = $this->magicContactIdMappingModel::query();

        // 保持原有的查询字段顺序
        // 根据环境ID数量选择合适的查询方式
        if (count($relationEnvIds) === 1) {
            $query->where('magic_environment_id', reset($relationEnvIds));
        } else {
            $query->whereIn('magic_environment_id', $relationEnvIds);
        }

        $query->whereIn('origin_id', $thirdUserIds)
            ->where('mapping_type', ThirdPlatformIdMappingType::User->value);

        // 有些平台多组织用户 id 一致（比如天书），因此查询时不带组织编码
        $magicOrganizationCode && $query->where('magic_organization_code', $magicOrganizationCode);
        $thirdPlatformIdMappingEntities = [];
        $data = $query->where('third_platform_type', $thirdPlatformType->value);
        $data = Db::select($data->toSql(), $data->getBindings());
        foreach ($data as $item) {
            $thirdPlatformIdMappingEntities[] = new MagicThirdPlatformIdMappingEntity($item);
        }
        return $thirdPlatformIdMappingEntities;
    }

    /**
     * 获取麦吉平台用户ID的映射关系.
     *
     * @param string[] $magicIds
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function getMagicIdsMapping(
        array $magicIds,
        ?string $magicOrganizationCode,
        PlatformType $thirdPlatformType
    ): array {
        $query = $this->magicContactIdMappingModel::query()
            ->whereIn('new_id', $magicIds)
            ->where('mapping_type', ThirdPlatformIdMappingType::User->value);
        // 有些平台多组织用户 id 一致（比如天书），因此查询时不带组织编码
        if ($thirdPlatformType !== PlatformType::Teamshare) {
            $magicOrganizationCode && $query->where('magic_organization_code', $magicOrganizationCode);
        }
        $thirdPlatformIdMappingEntities = [];
        $data = $query->where('third_platform_type', $thirdPlatformType->value);
        $data = Db::select($data->toSql(), $data->getBindings());
        foreach ($data as $item) {
            $thirdPlatformIdMappingEntities[] = new MagicThirdPlatformIdMappingEntity($item);
        }
        return $thirdPlatformIdMappingEntities;
    }

    /**
     * @param MagicThirdPlatformIdMappingEntity[] $thirdPlatformIdMappingEntities
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function createThirdPlatformIdsMapping(array $thirdPlatformIdMappingEntities): array
    {
        $thirdPlatformIdMappings = [];
        $time = date('Y-m-d H:i:s');
        foreach ($thirdPlatformIdMappingEntities as $magicThirdPlatformIdMappingEntity) {
            if (empty($magicThirdPlatformIdMappingEntity->getMagicEnvironmentId())) {
                ExceptionBuilder::throw(ChatErrorCode::MAGIC_ENVIRONMENT_NOT_FOUND);
            }
            if (empty($magicThirdPlatformIdMappingEntity->getNewId())) {
                $newId = (string) IdGenerator::getSnowId();
            } else {
                $newId = $magicThirdPlatformIdMappingEntity->getNewId();
            }
            if (empty($magicThirdPlatformIdMappingEntity->getId())) {
                $id = (string) IdGenerator::getSnowId();
            } else {
                $id = $magicThirdPlatformIdMappingEntity->getId();
            }
            $magicThirdPlatformIdMappingEntity->setNewId($newId);
            $magicThirdPlatformIdMappingEntity->setId($id);
            $magicThirdPlatformIdMappingEntity->setCreatedAt($time);
            $magicThirdPlatformIdMappingEntity->setUpdatedAt($time);
            $thirdPlatformIdMappings[] = [
                'id' => $id, // 暂时把主键 id设置为与new_id相同的值，以后有需要可以拆分
                'magic_organization_code' => $magicThirdPlatformIdMappingEntity->getMagicOrganizationCode(),
                'mapping_type' => $magicThirdPlatformIdMappingEntity->getMappingType(),
                'third_platform_type' => $magicThirdPlatformIdMappingEntity->getThirdPlatformType(),
                'origin_id' => $magicThirdPlatformIdMappingEntity->getOriginId(),
                'new_id' => $newId,
                'magic_environment_id' => $magicThirdPlatformIdMappingEntity->getMagicEnvironmentId(),
                'created_at' => $time,
                'updated_at' => $time,
                'deleted_at' => null,
            ];
        }
        $this->magicContactIdMappingModel::query()->insert($thirdPlatformIdMappings);
        return $thirdPlatformIdMappingEntities;
    }

    public function getDepartmentRootId(string $magicOrganizationCode, PlatformType $platformType): string
    {
        return $this->magicContactIdMappingModel::query()
            ->where('magic_organization_code', $magicOrganizationCode)
            ->where('mapping_type', ThirdPlatformIdMappingType::Department->value)
            ->where('third_platform_type', $platformType->value)
            ->where('origin_id', PlatformRootDepartmentId::Magic)
            ->value('new_id');
    }

    public function updateMappingEnvId(int $envId): int
    {
        return $this->magicContactIdMappingModel::query()
            ->where('magic_environment_id', 0)
            ->update(['magic_environment_id' => $envId]);
    }

    public function deleteThirdPlatformIdsMapping(
        array $originIds,
        string $magicOrganizationCode,
        PlatformType $thirdPlatformType,
        ThirdPlatformIdMappingType $mappingType
    ): int {
        if (empty($originIds)) {
            return 0;
        }
        return (int) $this->magicContactIdMappingModel::query()
            ->whereIn('origin_id', $originIds)
            ->where('magic_organization_code', $magicOrganizationCode)
            ->where('third_platform_type', $thirdPlatformType->value)
            ->where('mapping_type', $mappingType->value)
            ->delete();
    }

    /**
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function getThirdDepartments(array $currentDepartmentIds, string $magicOrganizationCode, PlatformType $thirdPlatformType): array
    {
        $mappingArrays = $this->magicContactIdMappingModel::query()
            ->whereIn('new_id', $currentDepartmentIds)
            ->where('mapping_type', ThirdPlatformIdMappingType::Department->value)
            ->where('magic_organization_code', $magicOrganizationCode)
            ->where('third_platform_type', $thirdPlatformType->value);
        $mappingArrays = Db::select($mappingArrays->toSql(), $mappingArrays->getBindings());
        return $this->convertToEntities($mappingArrays);
    }

    /**
     * 预发布和生产可以看做是一个环境，所以这里处理一下关联的环境 ids.
     * */
    private function getEnvRelationIds(MagicEnvironmentEntity $magicEnvironmentEntity): array
    {
        $relationEnvIds = $magicEnvironmentEntity->getExtra()?->getRelationEnvIds();
        if (empty($relationEnvIds)) {
            $relationEnvIds = [$magicEnvironmentEntity->getId()];
        } else {
            $relationEnvIds[] = $magicEnvironmentEntity->getId();
            // 对环境ID进行去重处理
            $relationEnvIds = array_unique($relationEnvIds);
        }
        return $relationEnvIds;
    }

    /**
     * 将数组数据转换为实体对象
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    private function convertToEntities(array $dataArrays): array
    {
        $result = [];
        foreach ($dataArrays as $data) {
            $entity = new MagicThirdPlatformIdMappingEntity();
            $entity->setId($data['id']);
            $entity->setOriginId($data['origin_id']);
            $entity->setNewId($data['new_id']);
            $entity->setThirdPlatformType(PlatformType::from($data['third_platform_type']));
            $entity->setMagicOrganizationCode($data['magic_organization_code']);
            $entity->setMappingType(ThirdPlatformIdMappingType::from($data['mapping_type']));
            $entity->setCreatedAt($data['created_at']);
            $entity->setUpdatedAt($data['updated_at']);
            $entity->setDeletedAt($data['deleted_at']);

            $result[] = $entity;
        }
        return $result;
    }
}
