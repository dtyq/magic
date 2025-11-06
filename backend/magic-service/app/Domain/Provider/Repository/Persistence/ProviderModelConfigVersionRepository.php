<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\ProviderModelConfigVersionEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelConfigVersionModel;
use Hyperf\DbConnection\Db;

class ProviderModelConfigVersionRepository extends AbstractProviderModelRepository implements ProviderModelConfigVersionRepositoryInterface
{
    // 配置版本表不需要组织隔离（通过 service_provider_model_id 关联已经隔离）
    protected bool $filterOrganizationCode = false;

    /**
     * 保存模型配置版本（在事务中完成版本号递增、标记旧版本、创建新版本）.
     */
    public function saveVersionWithTransaction(ProviderDataIsolation $dataIsolation, ProviderModelConfigVersionEntity $entity): void
    {
        Db::transaction(function () use ($dataIsolation, $entity) {
            $serviceProviderModelId = $entity->getServiceProviderModelId();

            // 1. 获取最新版本号并计算新版本号（使用 FOR UPDATE 行锁防止并发问题）
            $builder = $this->createBuilder($dataIsolation, ProviderModelConfigVersionModel::query());
            $latestVersion = $builder
                ->where('service_provider_model_id', $serviceProviderModelId)
                ->lockForUpdate()  // 悲观锁，防止并发
                ->max('version');

            $newVersion = $latestVersion ? (int) $latestVersion + 1 : 1;

            // 2. 将该模型的所有旧版本标记为非当前版本
            $updateBuilder = $this->createBuilder($dataIsolation, ProviderModelConfigVersionModel::query());
            $updateBuilder
                ->where('service_provider_model_id', $serviceProviderModelId)
                ->where('is_current_version', true)
                ->update(['is_current_version' => false]);

            // 3. 设置版本号并创建新版本记录
            $entity->setVersion($newVersion);
            $entity->setIsCurrentVersion(true);

            // 转换为数组并移除 null 的 created_at，让 Model 自动处理时间戳
            $data = $entity->toArray();

            ProviderModelConfigVersionModel::query()->create($data);
        });
    }

    /**
     * 获取指定模型的最新版本ID.
     */
    public function getLatestVersionId(ProviderDataIsolation $dataIsolation, int $serviceProviderModelId): ?int
    {
        $builder = $this->createBuilder($dataIsolation, ProviderModelConfigVersionModel::query());
        return $builder
            ->where('service_provider_model_id', $serviceProviderModelId)
            ->where('is_current_version', true)
            ->value('id');
    }

    /**
     * 获取指定模型的最新配置版本实体.
     */
    public function getLatestVersionEntity(ProviderDataIsolation $dataIsolation, int $serviceProviderModelId): ?ProviderModelConfigVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, ProviderModelConfigVersionModel::query());
        $model = $builder
            ->where('service_provider_model_id', $serviceProviderModelId)
            ->where('is_current_version', true)
            ->first();

        if ($model === null) {
            return null;
        }

        return new ProviderModelConfigVersionEntity($model->toArray());
    }
}
