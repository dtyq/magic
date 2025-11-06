<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Assembler;

use App\Domain\Provider\Entity\ProviderModelConfigVersionEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;

class ProviderModelAssembler extends AbstractProviderAssembler
{
    public static function toEntity(array $model): ProviderModelEntity
    {
        return self::createEntityFromArray(ProviderModelEntity::class, $model);
    }

    /**
     * @return ProviderModelEntity[]
     */
    public static function toEntities(array $models): array
    {
        return self::batchToEntities(ProviderModelEntity::class, $models);
    }

    /**
     * @param $modelEntities ProviderModelEntity[]
     */
    public static function toArrays(array $modelEntities): array
    {
        return self::batchToArrays($modelEntities);
    }

    /**
     * 将 ProviderModelEntity 转换为 ProviderModelConfigVersionEntity.
     */
    public static function toConfigVersionEntity(ProviderModelEntity $modelEntity): ProviderModelConfigVersionEntity
    {
        $config = $modelEntity->getConfig();

        $data = [
            'service_provider_model_id' => $modelEntity->getId(),
            'creativity' => $config?->getCreativity() ?? 0.5,
            'max_tokens' => $config?->getMaxTokens(),
            'temperature' => $config?->getTemperature(),
            'vector_size' => $config?->getVectorSize() ?? 2048,
            'billing_type' => $config?->getBillingType()->value ?? null,
            'time_pricing' => $config?->getTimePricing() ?? null,
            'input_pricing' => $config?->getInputPricing(),
            'output_pricing' => $config?->getOutputPricing(),
            'billing_currency' => $config?->getBillingCurrency(),
            'support_function' => $config?->isSupportFunction() ?? false,
            'cache_hit_pricing' => $config?->getCacheHitPricing(),
            'max_output_tokens' => $config?->getMaxOutputTokens(),
            'support_embedding' => $config?->isSupportEmbedding() ?? false,
            'support_deep_think' => $config?->isSupportDeepThink() ?? false,
            'cache_write_pricing' => $config?->getCacheWritePricing(),
            'support_multi_modal' => $config?->isSupportMultiModal() ?? false,
            'official_recommended' => $config?->isOfficialRecommended() ?? false,
            'input_cost' => $config?->getInputCost(),
            'output_cost' => $config?->getOutputCost(),
            'cache_hit_cost' => $config?->getCacheHitCost(),
            'cache_write_cost' => $config?->getCacheWriteCost(),
            'time_cost' => $config?->getTimeCost(),
        ];

        return self::createEntityFromArray(ProviderModelConfigVersionEntity::class, $data);
    }
}
