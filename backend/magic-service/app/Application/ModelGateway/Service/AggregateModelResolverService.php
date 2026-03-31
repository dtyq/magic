<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\AggregateStrategy;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use InvalidArgumentException;

use function Hyperf\Translation\__;

/**
 * 聚合模型解析服务.
 * 用于解析动态模型（聚合模型），根据策略返回真实模型ID.
 */
class AggregateModelResolverService
{
    public function __construct(
        private ProviderModelRepositoryInterface $providerModelRepository
    ) {
    }

    /**
     * 解析聚合模型，返回真实模型ID.
     * 使用已知的可用模型 ID 列表判断子模型权限，避免重复查询订阅信息.
     *
     * @param ProviderModelEntity $dynamicModel 已加载的动态模型实体
     * @param null|array $availableModelIds 当前套餐可用的模型 ID 列表（null 表示不限制）
     * @return null|string 解析出的真实模型 ID，null 表示无可用子模型
     */
    public function resolveWithAvailableIds(ProviderModelEntity $dynamicModel, ?array $availableModelIds): ?string
    {
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

        return $this->resolveByStrategyWithAvailableIds($strategy, $models, $strategyConfig, $availableModelIds);
    }

    /**
     * 解析聚合模型，返回真实模型ID.
     *
     * @param string $modelId 原始 model_id（可能是聚合模型）
     * @param ModelGatewayDataIsolation $dataIsolation 数据隔离对象
     * @return string 真实模型ID（如果是普通模型，直接返回原值）
     * @throws BusinessException 如果聚合模型的所有子模型都无权限
     */
    public function resolve(string $modelId, ModelGatewayDataIsolation $dataIsolation): string
    {
        // 1. 查询模型实体
        $providerDataIsolation = ProviderDataIsolation::createByBaseDataIsolation($dataIsolation);
        $providerDataIsolation->setContainOfficialOrganization(true);

        $model = $this->providerModelRepository->getByModelId($providerDataIsolation, $modelId);

        if (! $model || ! $model->isDynamicModel()) {
            // 普通模型，直接返回原值
            return $modelId;
        }

        $modelType = $model->getModelType();

        // 2. 解析聚合配置
        $config = $model->getAggregateConfig();
        if (! $config) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, __('service_provider.dynamic_model_config_invalid'));
        }

        $models = $config['models'] ?? [];
        if (empty($models)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, __('service_provider.dynamic_model_sub_models_empty'));
        }

        $strategy = $config['strategy'] ?? 'permission_fallback';
        $strategyConfig = $config['strategy_config'] ?? ['order' => 'asc'];

        // 3. 根据策略解析真实模型ID
        $realModelId = $this->resolveByStrategy($strategy, $models, $strategyConfig, $dataIsolation, $modelType);

        if (! $realModelId) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, __('service_provider.insufficient_permission_for_model'));
        }

        return $realModelId;
    }

    /**
     * 根据策略解析真实模型ID.
     */
    private function resolveByStrategy(string $strategy, array $models, array $strategyConfig, ModelGatewayDataIsolation $dataIsolation, ?ModelType $modelType): ?string
    {
        return match ($strategy) {
            AggregateStrategy::PERMISSION_FALLBACK->value => $this->resolveByPermissionFallback($models, $strategyConfig, $dataIsolation, $modelType),
            // 未来可扩展其他策略：'random', 'weighted', etc.
            default => throw new InvalidArgumentException("Unknown strategy: {$strategy}")
        };
    }

    /**
     * 使用已知可用模型 ID 列表按策略解析真实模型ID.
     */
    private function resolveByStrategyWithAvailableIds(string $strategy, array $models, array $strategyConfig, ?array $availableModelIds): ?string
    {
        return match ($strategy) {
            AggregateStrategy::PERMISSION_FALLBACK->value => $this->resolveByPermissionFallbackWithAvailableIds($models, $strategyConfig, $availableModelIds),
            default => throw new InvalidArgumentException("Unknown strategy: {$strategy}")
        };
    }

    /**
     * 使用已知可用模型 ID 列表按权限降级策略解析真实模型ID.
     * availableModelIds 为 null 时表示不限制，直接返回第一个子模型.
     */
    private function resolveByPermissionFallbackWithAvailableIds(array $models, array $strategyConfig, ?array $availableModelIds): ?string
    {
        $order = $strategyConfig['order'] ?? 'asc';
        $modelsToCheck = $order === 'desc' ? array_reverse($models) : $models;

        foreach ($modelsToCheck as $modelItem) {
            $subModelId = $this->extractModelId($modelItem);
            if (! $subModelId) {
                continue;
            }

            // availableModelIds 为 null 表示不限制权限，直接返回第一个可用子模型
            if ($availableModelIds === null || in_array($subModelId, $availableModelIds, true)) {
                return $subModelId;
            }
        }

        return null;
    }

    /**
     * 按照权限降级策略解析真实模型ID.
     * 按照配置的模型顺序，找到第一个用户有权限使用的模型.
     */
    private function resolveByPermissionFallback(array $models, array $strategyConfig, ModelGatewayDataIsolation $dataIsolation, ?ModelType $modelType): ?string
    {
        $order = $strategyConfig['order'] ?? 'asc';

        // 根据顺序方向决定遍历顺序
        $modelsToCheck = $order === 'desc' ? array_reverse($models) : $models;

        foreach ($modelsToCheck as $modelItem) {
            // 支持对象数组和字符串数组两种格式（向后兼容）
            $subModelId = $this->extractModelId($modelItem);

            if (! $subModelId) {
                continue;
            }

            // 检查用户是否有权限使用该模型
            if ($dataIsolation->getSubscriptionManager()->isValidModelAvailable($subModelId, $modelType)) {
                return $subModelId;
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
