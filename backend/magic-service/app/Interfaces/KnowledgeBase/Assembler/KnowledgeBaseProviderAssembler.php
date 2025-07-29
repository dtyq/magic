<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Assembler;

use App\Application\ModelGateway\Mapper\OdinModel;
use App\Interfaces\KnowledgeBase\DTO\ServiceProviderDTO;
use App\Interfaces\KnowledgeBase\DTO\ServiceProviderModelDTO;

class KnowledgeBaseProviderAssembler
{
    public static function odinModelToProviderDTO(array $models): array
    {
        $dtoList = [];
        /** @var array<string, array<OdinModel>> $providerAliasModelsMap */
        $providerAliasModelsMap = [];
        foreach ($models as $model) {
            $providerAlias = $model->getAttributes()->getProviderAlias();
            empty($providerAlias) && $providerAlias = 'MagicAI';
            $providerAliasModelsMap[$providerAlias][] = $model;
        }
        foreach ($providerAliasModelsMap as $providerAlias => $providerModels) {
            $dto = new ServiceProviderDTO();
            $dto->setId($providerAlias);
            $dto->setName($providerAlias);
            $modelsForProvider = [];
            foreach ($providerModels as $providerModel) {
                $modelDTO = new ServiceProviderModelDTO();
                $modelDTO->setId($providerModel->getAttributes()->getKey());
                $modelDTO->setName($providerModel->getAttributes()->getLabel());
                $modelDTO->setModelId($providerModel->getAttributes()->getName());
                $modelDTO->setIcon($providerModel->getAttributes()->getIcon());
                $modelsForProvider[] = $modelDTO;
            }
            $dto->setModels($modelsForProvider);
            $dtoList[] = $dto;
        }
        return $dtoList;
    }
}
