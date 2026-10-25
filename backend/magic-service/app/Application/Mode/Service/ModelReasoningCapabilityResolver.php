<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\ModelGateway\Service\AggregateModelResolverService;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ModelAccessContext;
use App\Domain\Provider\Entity\ProviderModelEntity;

/** 从已加载模型解析面向前台的思考能力，保持权限与运行时路由策略一致。 */
class ModelReasoningCapabilityResolver
{
    /** 注入现有动态模型解析器，不维护另一份路由策略。 */
    public function __construct(private readonly AggregateModelResolverService $aggregateResolver)
    {
    }

    /**
     * 批量解析能力；预加载候选模型避免嵌套动态模型的重复查询。
     * @param array<string, ProviderModelEntity> $models
     * @param array<string, ProviderModelEntity> $preloadedModels
     * @return array<string, array{resolved_model_id: string, reasoning_effort_levels: list<string>, reasoning_effort_default: ?string}>
     */
    public function resolve(array $models, array $preloadedModels, ModelGatewayDataIsolation $isolation, ?ModelAccessContext $accessContext): array
    {
        $result = [];
        foreach ($models as $model) {
            $resolvedId = $model->getModelId();
            if ($model->isDynamicModel()) {
                $visited = [];
                $resolvedId = $this->aggregateResolver->resolveModel($model, $isolation, $accessContext, $visited, $preloadedModels) ?? '';
            }
            $resolved = $model->isDynamicModel() ? ($preloadedModels[$resolvedId] ?? null) : $model;
            $result[$model->getModelId()] = [
                'resolved_model_id' => $resolvedId,
                'reasoning_effort_levels' => $resolved?->getConfig()?->getEffectiveReasoningEffortLevels() ?? [],
                'reasoning_effort_default' => $resolved?->getConfig()?->getEffectiveReasoningEffortDefault(),
            ];
        }
        return $result;
    }
}
