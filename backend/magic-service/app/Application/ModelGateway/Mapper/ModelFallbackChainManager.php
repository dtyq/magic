<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;

readonly class ModelFallbackChainManager
{
    public function __construct(
        private ModelGatewayMapper $modelGatewayMapper
    ) {
    }

    public function get(ModelGatewayDataIsolation $modelGatewayDataIsolation, string $modelId, string $modelType = 'chat', int $limit = 3, bool $throwFallback = false): array
    {
        $odinModels = match ($modelType) {
            'chat' => $this->modelGatewayMapper->getChatModels($modelGatewayDataIsolation),
            'embedding' => $this->modelGatewayMapper->getEmbeddingModels($modelGatewayDataIsolation),
            default => [],
        };

        $modelIds = array_keys($odinModels);

        if ($throwFallback) {
            // 如果开启异常回退那么就是多个模型返回
            $modelIds = array_slice($modelIds, 0, $limit);
            return array_merge([$modelId], $modelIds);
        }

        // 如果没有开启，仅检测当前模型是否在列表中
        if (in_array($modelId, $modelIds, true)) {
            return [$modelId];
        }

        // 如果不在，则获取第一个模型
        return [$modelIds[0]];
    }
}
