<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Domain\Provider\DTO\ProviderOriginalModelDTO;
use App\Domain\Provider\Entity\ProviderOriginalModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\ProviderOriginalModelType;
use App\Domain\Provider\Service\ProviderOriginalModelDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\Assembler\ProviderAdminAssembler;

class AdminOriginModelAppService
{
    public function __construct(
        private ProviderOriginalModelDomainService $providerOriginalModelDomainService,
    ) {
    }

    /**
     * 获取原始模型列表.
     *
     * @return array<ProviderOriginalModelDTO>
     */
    public function list(MagicUserAuthorization $authorization): array
    {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );
        $entities = $this->providerOriginalModelDomainService->list($dataIsolation);
        return ProviderAdminAssembler::originalModelEntitiesToDTOs($entities);
    }

    /**
     * 添加模型标识.
     */
    public function create(MagicUserAuthorization $authorization, string $modelId): ProviderOriginalModelDTO
    {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        $entity = new ProviderOriginalModelEntity();
        $entity->setModelId($modelId);
        $entity->setType(ProviderOriginalModelType::Custom);
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

        $createdEntity = $this->providerOriginalModelDomainService->create($dataIsolation, $entity);

        return ProviderAdminAssembler::originalModelEntityToDTO($createdEntity);
    }

    /**
     * 删除模型标识.
     */
    public function delete(MagicUserAuthorization $authorization, string $id): void
    {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );
        $this->providerOriginalModelDomainService->delete($dataIsolation, $id);
    }
}
