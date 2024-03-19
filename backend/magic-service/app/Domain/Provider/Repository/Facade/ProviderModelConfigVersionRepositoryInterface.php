<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Facade;

use App\Domain\Provider\Entity\ProviderModelConfigVersionEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;

interface ProviderModelConfigVersionRepositoryInterface
{
    /**
     * 保存模型配置版本（包含版本号递增和标记当前版本的完整逻辑）.
     * 使用事务确保数据一致性.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param ProviderModelConfigVersionEntity $entity 配置版本实体
     */
    public function saveVersionWithTransaction(ProviderDataIsolation $dataIsolation, ProviderModelConfigVersionEntity $entity): void;

    /**
     * 获取指定模型的最新版本ID.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param int $serviceProviderModelId 模型ID
     * @return null|int 最新版本的ID，如果不存在则返回null
     */
    public function getLatestVersionId(ProviderDataIsolation $dataIsolation, int $serviceProviderModelId): ?int;

    /**
     * 获取指定模型的最新配置版本实体.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param int $serviceProviderModelId 模型ID
     * @return null|ProviderModelConfigVersionEntity 最新版本的实体，如果不存在则返回null
     */
    public function getLatestVersionEntity(ProviderDataIsolation $dataIsolation, int $serviceProviderModelId): ?ProviderModelConfigVersionEntity;
}
