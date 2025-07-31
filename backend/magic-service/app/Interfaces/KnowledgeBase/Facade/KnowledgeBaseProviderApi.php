<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use App\Domain\ModelAdmin\Constant\ServiceProviderType;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderDTO;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderModelsDTO;
use App\Interfaces\KnowledgeBase\Assembler\KnowledgeBaseProviderAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;

#[ApiResponse(version: 'low_code')]
class KnowledgeBaseProviderApi extends AbstractKnowledgeBaseApi
{
    /**
     * 获取官方重排序提供商列表.
     * @return array<ServiceProviderDTO>
     */
    public function getOfficialRerankProviderList()
    {
        $dto = new ServiceProviderDTO();
        $dto->setId('official_rerank');
        $dto->setName('官方重排序服务商');
        $dto->setProviderType(ServiceProviderType::OFFICIAL->value);
        $dto->setDescription('官方提供的重排序服务');
        $dto->setIcon('');
        $dto->setCategory('rerank');
        $dto->setStatus(1); // 1 表示启用
        $dto->setCreatedAt(date('Y-m-d H:i:s'));

        // 设置模型列表
        $models = [];

        // 基础重排序模型
        $baseModel = new ServiceProviderModelsDTO();
        $baseModel->setId('official_rerank_model');
        $baseModel->setName('官方重排模型');
        $baseModel->setModelVersion('v1.0');
        $baseModel->setDescription('基础重排序模型，适用于一般场景');
        $baseModel->setIcon('');
        $baseModel->setModelType(1);
        $baseModel->setCategory('rerank');
        $baseModel->setStatus(1);
        $baseModel->setSort(1);
        $baseModel->setCreatedAt(date('Y-m-d H:i:s'));
        $models[] = $baseModel;

        $dto->setModels($models);

        return [$dto];
    }

    /**
     * 获取嵌入提供商列表.
     * @return array<ServiceProviderDTO>
     */
    public function getEmbeddingProviderList(): array
    {
        $userAuthorization = $this->getAuthorization();
        $models = $this->modelGatewayMapper->getEmbeddingModels($userAuthorization->getOrganizationCode());
        return KnowledgeBaseProviderAssembler::odinModelToProviderDTO($models);
    }
}
