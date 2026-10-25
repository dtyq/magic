<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Domain\Provider\DTO\Item\ModelConfigItem;
use App\Domain\Provider\DTO\Item\TokenPricing\BillingObject;

/** 解析文本模型售价摘要，供前台倍率与管理预览共用，不读取成本或计算基准。 */
class TextModelPriceSummaryResolver
{
    public const int SCALE = 36;

    /** 按现有计价规则提供白名单摘要和绑定排除原因。 */
    public function resolve(?ModelConfigItem $config): array
    {
        $input = $this->priceItem($config, BillingObject::INPUT_TOKEN);
        $output = $this->priceItem($config, BillingObject::OUTPUT_TOKEN);
        $currency = $config?->getBillingCurrency();
        $reason = match (true) {
            $config === null => 'missing_config',
            ! $config->getBillingType()->isTokens() => 'unsupported_billing',
            ! in_array($currency, ['CNY', 'USD'], true) => 'unsupported_currency',
            $input['status'] === 'invalid' || $output['status'] === 'invalid' => $this->hasEmptyRules($config) ? 'empty_rules' : 'invalid_price',
            default => null,
        };
        return [
            'currency' => in_array($currency, ['CNY', 'USD'], true) ? $currency : null,
            'eligible' => $reason === null,
            'exclusion_reason' => $reason,
            'input' => $input,
            'output' => $output,
        ];
    }

    /** 缺项视为零；已有阶梯不回退旧单价，逐档等权平均并保留计算来源。 */
    private function priceItem(?ModelConfigItem $config, string $object): array
    {
        $result = ['status' => 'missing_as_zero', 'effective_unit_price' => '0', 'source' => 'missing', 'rule_prices' => []];
        if ($config === null) {
            return $result;
        }
        $tiers = $config->getBillingTiers();
        if ($tiers === null) {
            $raw = $object === BillingObject::INPUT_TOKEN ? $config->getInputPricing() : $config->getOutputPricing();
            if ($raw === null) {
                return $result;
            }
            $price = $this->decimalPrice($raw);
            return ['status' => $price === null ? 'invalid' : 'priced', 'effective_unit_price' => $price,
                'source' => 'legacy', 'rule_prices' => $price === null ? [] : [$price]];
        }
        $tier = $tiers->getBillingTier($object);
        if ($tier === null) {
            return $result;
        }
        $result = ['status' => 'invalid', 'effective_unit_price' => null,
            'source' => $tier->getPricingMode()->value, 'rule_prices' => []];
        $rules = $tier->getPricingRules();
        if ($rules === []) {
            return $result;
        }
        $sum = '0';
        foreach ($rules as $rule) {
            $price = $this->decimalPrice((string) $rule->getPrice());
            if ($price === null) {
                return $result;
            }
            $result['rule_prices'][] = $price;
            $sum = bcadd($sum, $price, self::SCALE);
        }
        $result['status'] = 'priced';
        $result['effective_unit_price'] = bcdiv($sum, (string) count($rules), self::SCALE);
        return $result;
    }

    /** 区分规则为空与非法单价，便于管理端解释排除原因。 */
    private function hasEmptyRules(ModelConfigItem $config): bool
    {
        foreach ([BillingObject::INPUT_TOKEN, BillingObject::OUTPUT_TOKEN] as $object) {
            $tier = $config->getBillingTiers()?->getBillingTier($object);
            if ($tier !== null && $tier->getPricingRules() === []) {
                return true;
            }
        }
        return false;
    }

    /** 保持前台既有的科学计数法归一化和非法历史价格处理语义。 */
    private function decimalPrice(?string $price): ?string
    {
        if ($price === null || ! is_numeric($price) || ! is_finite((float) $price) || (float) $price < 0) {
            return null;
        }
        return preg_match('/^\d+(?:\.\d+)?$/D', $price) ? $price : sprintf('%.24F', (float) $price);
    }
}
