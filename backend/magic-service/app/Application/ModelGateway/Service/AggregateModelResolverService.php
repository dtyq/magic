<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ModelAccessContext;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\AggregateStrategy;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use InvalidArgumentException;

use function Hyperf\Translation\__;

/**
 * 聚合模型解析服务.
 * 用于解析动态模型（聚合模型），根据策略返回真实模型ID.
 */
readonly class AggregateModelResolverService
{
    public function __construct(
        private ProviderModelRepositoryInterface $providerModelRepository
    ) {
    }

    /**
     * 解析聚合模型，返回真实模型ID.
     *
     * @param string $modelId 原始 model_id（可能是聚合模型）
     * @param ModelGatewayDataIsolation $dataIsolation 数据隔离对象
     * @param null|ModelAccessContext $accessContext 当前用户最终模型访问上下文；传入后会在订阅权限之外额外叠加用户级模型权限校验
     * @return string 真实模型ID（如果是普通模型，直接返回原值）
     */
    public function resolve(
        string $modelId,
        ModelGatewayDataIsolation $dataIsolation,
        ?ModelAccessContext $accessContext = null
    ): string {
        $model = $this->getProviderModel($modelId, $dataIsolation);

        if (! $model || ! $model->isDynamicModel()) {
            return $modelId;
        }

        $visitedModelIds = [];
        $realModelId = $this->resolveModel($model, $dataIsolation, $accessContext, $visitedModelIds);

        if (! $realModelId) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, __('service_provider.insufficient_permission_for_model'));
        }

        return $realModelId;
    }

    /**
     * 解析聚合模型，返回真实模型ID（基于已加载实体，避免重复查库）.
     * 使用订阅管理器做实时权限判断，与请求时 resolve() 的行为保持一致.
     *
     * @param ProviderModelEntity $dynamicModel 已加载的动态模型实体
     * @param ModelGatewayDataIsolation $dataIsolation 数据隔离对象
     * @param null|ModelAccessContext $accessContext 当前用户最终模型访问上下文；为空时仅按 subscription 语义筛选子模型
     * @param array<string, true> $visitedModelIds 当前递归链路已访问的动态模型 ID 集合，用于防止动态模型互相引用造成死循环
     * @param-out array<string, true> $visitedModelIds
     * @return null|string 解析出的真实模型 ID，null 表示无可用子模型
     */
    public function resolveModel(
        ProviderModelEntity $dynamicModel,
        ModelGatewayDataIsolation $dataIsolation,
        ?ModelAccessContext $accessContext = null,
        array &$visitedModelIds = []
    ): ?string {
        $dynamicModelId = $dynamicModel->getModelId();
        if ($dynamicModelId === '' || isset($visitedModelIds[$dynamicModelId])) {
            return null;
        }
        $visitedModelIds[$dynamicModelId] = true;

        $config = $dynamicModel->getAggregateConfig();
        if (! $config) {
            return null;
        }

        $models = $config['models'] ?? [];
        if (empty($models)) {
            return null;
        }

        $strategy = $config['strategy'] ?? 'permission_fallback';
        $strategyConfig = $config['strategy_config'] ?? ['order' => 'asc'];

        return $this->resolveByStrategy(
            $strategy,
            $models,
            $strategyConfig,
            $dataIsolation,
            $dynamicModel->getModelType(),
            $accessContext,
            $visitedModelIds
        );
    }

    protected function getProviderModel(string $modelId, ModelGatewayDataIsolation $dataIsolation): ?ProviderModelEntity
    {
        $providerDataIsolation = ProviderDataIsolation::createByBaseDataIsolation($dataIsolation);
        $providerDataIsolation->setContainOfficialOrganization(true);

        return $this->providerModelRepository->getByModelId($providerDataIsolation, $modelId);
    }

    /**
     * 根据策略解析真实模型ID.
     *
     * @param string $strategy 聚合模型配置的解析策略
     * @param array $models 当前策略下的候选子模型列表
     * @param array $strategyConfig 当前策略配置
     * @param ModelGatewayDataIsolation $dataIsolation 数据隔离对象
     * @param null|ModelType $modelType 模型类型，用于交给 subscription 做类型内可用性判断
     * @param null|ModelAccessContext $accessContext 当前用户最终模型访问上下文；传入后会额外叠加用户级权限过滤
     * @param array<string, true> $visitedModelIds 当前递归链路已访问的动态模型 ID 集合，用于防环
     * @param-out array<string, true> $visitedModelIds
     */
    private function resolveByStrategy(
        string $strategy,
        array $models,
        array $strategyConfig,
        ModelGatewayDataIsolation $dataIsolation,
        ?ModelType $modelType,
        ?ModelAccessContext $accessContext,
        array &$visitedModelIds
    ): ?string {
        return match ($strategy) {
            AggregateStrategy::PERMISSION_FALLBACK->value => $this->resolveByPermissionFallback(
                $models,
                $strategyConfig,
                $dataIsolation,
                $modelType,
                $accessContext,
                $visitedModelIds
            ),
            // 未来可扩展其他策略：'random', 'weighted', etc.
            default => throw new InvalidArgumentException("Unknown strategy: {$strategy}")
        };
    }

    /**
     * 按照权限降级策略解析真实模型ID.
     * 按照配置的模型顺序，找到第一个用户有权限使用的模型.
     *
     * @param array<string, true> $visitedModelIds 当前递归链路已访问的动态模型 ID 集合，用于防环
     * @param-out array<string, true> $visitedModelIds
     */
    private function resolveByPermissionFallback(
        array $models,
        array $strategyConfig,
        ModelGatewayDataIsolation $dataIsolation,
        ?ModelType $modelType,
        ?ModelAccessContext $accessContext,
        array &$visitedModelIds
    ): ?string {
        $order = $strategyConfig['order'] ?? 'asc';

        // 根据顺序方向决定遍历顺序
        $modelsToCheck = $order === 'desc' ? array_reverse($models) : $models;

        foreach ($modelsToCheck as $modelItem) {
            // 支持对象数组和字符串数组两种格式（向后兼容）
            $subModelId = $this->extractModelId($modelItem);

            if (! $subModelId) {
                continue;
            }

            if (! $dataIsolation->getSubscriptionManager()->isValidModelAvailable($subModelId, $modelType)) {
                continue;
            }

            if ($accessContext?->isRestricted() && ! $accessContext->canAccess($subModelId)) {
                continue;
            }

            $subModel = $this->getProviderModel($subModelId, $dataIsolation);
            if (! $subModel?->isDynamicModel()) {
                return $subModelId;
            }

            $resolvedModelId = $this->resolveModel($subModel, $dataIsolation, $accessContext, $visitedModelIds);
            if ($resolvedModelId !== null) {
                return $resolvedModelId;
            }
        }

        return null;
    }

    /**
     * 从模型项中提取 model_id.
     * 支持对象数组格式（包含 model_id 字段）和字符串格式（向后兼容）.
     *
     * @param array|string $modelItem 模型项（对象数组或字符串）
     * @return null|string 提取的 model_id，如果无法提取则返回 null
     */
    private function extractModelId(array|string $modelItem): ?string
    {
        // 如果是字符串，直接返回（向后兼容）
        if (is_string($modelItem)) {
            return $modelItem;
        }

        // 此时 $modelItem 只能是数组类型，提取 model_id 字段
        return $modelItem['model_id'] ?? null;
    }
}
