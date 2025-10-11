<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderConfigQuery;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\ValueObject\Page;

readonly class ProviderManager
{
    public function __construct(
        private ProviderModelDomainService $providerModelDomainService,
        private ProviderConfigDomainService $providerConfigDomainService,
        private ProviderDomainService $providerDomainService,
    ) {
    }

    public function getAvailableByModelIdOrId(ProviderDataIsolation $providerDataIsolation, string $modelIdOrId): ?ProviderModelEntity
    {
        return $this->providerModelDomainService->getAvailableByModelIdOrId($providerDataIsolation, $modelIdOrId);
    }

    /**
     * @return array<ProviderModelEntity>
     */
    public function getModelsByModelIds(ProviderDataIsolation $providerDataIsolation, ?array $modelIds, ?ModelType $modelType): array
    {
        if ($providerDataIsolation->isOfficialOrganization()) {
            $modelIds = null;
        }
        $query = new ProviderModelQuery();
        $query->setModelIds($modelIds);
        $query->setStatus(Status::Enabled);
        $query->setModelType($modelType);

        $query->setOrder(['model_id' => 'asc']);
        $data = $this->providerModelDomainService->queries($providerDataIsolation, $query, Page::createNoPage());
        return $data['list'] ?? [];
    }

    /**
     * 获取可用的模型ID列表
     *
     * @param ProviderDataIsolation $providerDataIsolation 数据隔离对象
     * @return array<string, array<string>> 按模型类型分组的模型ID数组，格式: [modelType => [model_id, model_id]]
     */
    public function getModelIdsGroupByType(ProviderDataIsolation $providerDataIsolation): array
    {
        $query = new ProviderModelQuery();
        $query->setStatus(Status::Enabled);
        $query->setOrder(['model_id' => 'asc']);

        return $this->providerModelDomainService->getModelIdsGroupByType($providerDataIsolation, $query);
    }

    /**
     * @return array<int, ProviderConfigEntity>
     */
    public function getProviderConfigsByIds(ProviderDataIsolation $providerDataIsolation, array $providerConfigIds): array
    {
        if (empty($providerConfigIds)) {
            return [];
        }
        $query = new ProviderConfigQuery();
        $query->setIds($providerConfigIds);

        $query->setKeyBy('id');
        $data = $this->providerConfigDomainService->queries($providerDataIsolation, $query, Page::createNoPage());
        return $data['list'] ?? [];
    }

    /**
     * @return array<int, ProviderEntity>
     */
    public function getProvidersByIds(ProviderDataIsolation $providerDataIsolation, array $providerIds): array
    {
        if (empty($providerIds)) {
            return [];
        }
        $query = new ProviderQuery();
        $query->setIds($providerIds);
        $query->setKeyBy('id');
        $data = $this->providerDomainService->queries($providerDataIsolation, $query, Page::createNoPage());
        return $data['list'] ?? [];
    }
}
