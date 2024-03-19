<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Assembler;

use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Interfaces\KnowledgeBase\DTO\ServiceProviderDTO;
use App\Interfaces\KnowledgeBase\DTO\ServiceProviderModelDTO;

class KnowledgeBaseProviderAssembler
{
    /**
     * @param array<string, ModelConfigEntity> $models
     */
    public static function odinModelToProviderDTO(array $models): array
    {
        $dtoList = [];
        foreach ($models as $modelId => $model) {
            $providerAlias = $model->getInfo()['attributes']['provider_alias'] ?? 'MagicAI';
            if (! isset($dtoList[$providerAlias])) {
                $dtoList[$providerAlias] = new ServiceProviderDTO([
                    'id' => $providerAlias,
                    'name' => $providerAlias,
                    'models' => [],
                ]);
            }

            $modelDTO = new ServiceProviderModelDTO();
            $modelDTO->setId($modelId);
            $modelDTO->setName($model->getName());
            $modelDTO->setModelId($modelId);
            $modelDTO->setIcon($model->getInfo()['attributes']['icon'] ?? '');
            $dtoList[$providerAlias]->addModel($modelDTO);
        }
        return array_values($dtoList);
    }
}
