<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Kernel\DTO\ModelBillingMultiplierSettings;
use App\Domain\Provider\Entity\ProviderModelEntity;

/** 基于已过滤的服务商快照计算参考倍率，不查询数据库、不触发动态路由。 */
class ModelBillingMultiplierCalculator
{
    // 十二位源单价与十二位汇率相乘后仍保留足够精度。
    private const int SCALE = 36;

    /** 复用售价解析规则，保留直接构造纯计算器的兼容方式。 */
    public function __construct(private readonly TextModelPriceSummaryResolver $priceResolver = new TextModelPriceSummaryResolver())
    {
    }

    /** 使用能力解析的同一真实模型标识，每个绑定等权，仅跳过无效绑定。 */
    public function calculate(array $capabilities, array $availableGroups, ModelBillingMultiplierSettings $settings): array
    {
        $result = [];
        $resolvedMultipliers = [];
        foreach ($capabilities as $modelId => $capability) {
            if (! $settings->enabled) {
                $result[$modelId] = null;
                continue;
            }
            // 手动值按逻辑模型独立生效，不进入真实模型自动计算缓存。
            $override = $settings->getModelOverride((string) $modelId);
            if ($override !== null) {
                $result[$modelId] = (float) $override;
                continue;
            }
            $resolvedId = $capability['resolved_model_id'];
            if (! array_key_exists($resolvedId, $resolvedMultipliers)) {
                $sum = '0';
                $count = 0;
                foreach ($availableGroups[$resolvedId] ?? [] as $model) {
                    if ($model->isDynamicModel()) {
                        continue;
                    }
                    $amount = $this->referenceAmount($model, $settings);
                    if ($amount !== null) {
                        $sum = bcadd($sum, $amount, self::SCALE);
                        ++$count;
                    }
                }
                $resolvedMultipliers[$resolvedId] = $count === 0 ? 0.0 : (float) bcdiv(
                    bcdiv($sum, (string) $count, self::SCALE),
                    $settings->basePriceCny,
                    self::SCALE
                );
            }
            $result[$modelId] = $resolvedMultipliers[$resolvedId];
        }
        return $result;
    }

    /** 固定参考输入一万、输出一千 token；金额均转换为人民币后再平均。 */
    private function referenceAmount(ProviderModelEntity $model, ModelBillingMultiplierSettings $settings): ?string
    {
        $summary = $this->priceResolver->resolve($model->getConfig());
        if (! $summary['eligible']) {
            return null;
        }
        $amount = bcadd(
            bcmul($summary['input']['effective_unit_price'], '0.01', self::SCALE),
            bcmul($summary['output']['effective_unit_price'], '0.001', self::SCALE),
            self::SCALE
        );
        return $summary['currency'] === 'USD' ? bcmul($amount, $settings->usdToCnyRate, self::SCALE) : $amount;
    }
}
