<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use App\Application\ModelGateway\DTO\Common\BusinessParamsDTO;
use App\Domain\Provider\DTO\ProviderConfigModelsDTO;
use App\Domain\Provider\DTO\ProviderModelDetailDTO;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderType;
use Dtyq\ApiResponse\Annotation\ApiResponse;

#[ApiResponse(version: 'low_code')]
class KnowledgeBaseProviderApi extends AbstractKnowledgeBaseApi
{
    /**
     * 获取官方重排序提供商列表.
     * @return array<ProviderConfigModelsDTO>
     */
    public function getOfficialRerankProviderList(): array
    {
        $dto = new ProviderConfigModelsDTO();
        $dto->setId('official_rerank');
        $dto->setName('official_rerank');
        $dto->setProviderType(ProviderType::Official->value);
        $dto->setDescription('official_rerank');
        $dto->setIcon('');
        $dto->setCategory('rerank');
        $dto->setStatus(1); // 1 表示启用
        $dto->setCreatedAt(date('Y-m-d H:i:s'));

        // 设置模型列表
        $models = [];

        // 基础重排序模型
        $baseModel = new ProviderModelDetailDTO();
        $baseModel->setId('official_rerank_model');
        $baseModel->setName('official_rerank');
        $baseModel->setModelVersion('v1.0');
        $baseModel->setDescription('');
        $baseModel->setIcon('');
        $baseModel->setModelType(1);
        $baseModel->setCategory(Category::RERANK);
        $baseModel->setStatus(1);
        $baseModel->setSort(1);
        $baseModel->setCreatedAt(date('Y-m-d H:i:s'));
        $models[] = $baseModel;

        $dto->setModels($models);

        return [$dto];
    }

    /**
     * 获取嵌入提供商列表.
     * @return array<ProviderConfigModelsDTO>
     */
    public function getEmbeddingProviderList(): array
    {
        $userAuthorization = $this->getAuthorization();
        $businessParams = new BusinessParamsDTO(
            organizationCode: $userAuthorization->getOrganizationCode(),
            userId: $userAuthorization->getId(),
        );
        return $this->embeddingProviderPort->listProviders($businessParams);
    }
}
