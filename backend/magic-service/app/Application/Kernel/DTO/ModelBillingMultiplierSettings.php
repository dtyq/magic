<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\DTO;

use InvalidArgumentException;

/** 平台参考倍率配置，只影响展示，不参与实际结算。 */
final readonly class ModelBillingMultiplierSettings
{
    private const DEFAULT_USD_TO_CNY_RATE = '7';

    private const REFERENCE_AMOUNT_SCALE = 27;

    /** 单价原文和币种一起保存，参考金额始终归一到人民币。 */
    private function __construct(
        public bool $enabled,
        public ?string $basePriceCny,
        public string $usdToCnyRate,
        public string $currency,
        public ?string $inputPrice,
        public ?string $outputPrice,
        public array $modelOverrides,
    ) {
    }

    /** 只读取标准单价，参考金额始终从源单价计算，忽略存储中的派生金额。 */
    public static function fromArray(array $data): self
    {
        $enabled = (bool) ($data['enabled'] ?? false);
        $currency = $data['currency'] ?? 'CNY';
        if (! in_array($currency, ['CNY', 'USD'], true)) {
            throw new InvalidArgumentException('Reference price currency must be CNY or USD');
        }
        $rate = self::decimal($data['usd_to_cny_rate'] ?? null) ?? self::DEFAULT_USD_TO_CNY_RATE;
        $input = self::decimal($data['input_price'] ?? null, true);
        $output = self::decimal($data['output_price'] ?? null, true);
        if ($input !== null || $output !== null) {
            if ($input === null || $output === null || (bccomp($input, '0', 12) === 0 && bccomp($output, '0', 12) === 0)) {
                throw new InvalidArgumentException('Both reference token prices are required and must not both be zero');
            }
            // 始终按源单价重算，不能把前次换算后的金额再次乘汇率。
            $amount = bcadd(bcmul($input, '0.01', 15), bcmul($output, '0.001', 15), 15);
            $base = $currency === 'USD' ? bcmul($amount, $rate, self::REFERENCE_AMOUNT_SCALE) : $amount;
            $base = rtrim(rtrim($base, '0'), '.');
        } else {
            $base = null;
        }
        if ($enabled && $base === null) {
            throw new InvalidArgumentException('Enabled model multiplier requires a positive reference amount');
        }
        return new self($enabled, $base, $rate, $currency, $input, $output, self::parseModelOverrides(array_key_exists('model_overrides', $data) ? $data['model_overrides'] : []));
    }

    /** 部分更新仅接收标准字段，不允许旧别名或派生金额参与覆盖。 */
    public function withOverrides(array $overrides): self
    {
        $allowed = ['enabled', 'currency', 'input_price', 'output_price', 'usd_to_cny_rate', 'model_overrides'];
        if (array_diff(array_keys($overrides), $allowed) !== []) {
            throw new InvalidArgumentException('Unsupported model multiplier configuration fields');
        }
        return self::fromArray(array_replace($this->toArray(), $overrides));
    }

    /** 返回统一配置，参考金额只作为后端计算结果提供。 */
    public function toArray(): array
    {
        return [
            'enabled' => $this->enabled,
            'base_price_cny' => $this->basePriceCny,
            'usd_to_cny_rate' => $this->usdToCnyRate,
            'currency' => $this->currency,
            'input_price' => $this->inputPrice,
            'output_price' => $this->outputPrice,
            'model_overrides' => $this->modelOverrides,
        ];
    }

    /** 按前台逻辑标识查询覆盖，不共享动态模型解析后的真实模型标识。 */
    public function getModelOverride(string $modelId): ?string
    {
        foreach ($this->modelOverrides as $override) {
            if ($override['model_id'] === $modelId) {
                return $override['multiplier'];
            }
        }
        return null;
    }

    /** 校验完整覆盖集合，空集合表示清空，非法或重复条目拒绝整次保存。 */
    private static function parseModelOverrides(mixed $overrides): array
    {
        if (! is_array($overrides) || ! array_is_list($overrides)) {
            throw new InvalidArgumentException('Model overrides must be a list');
        }
        $seen = [];
        foreach ($overrides as $override) {
            if (! is_array($override) || count($override) !== 2
                || ! is_string($id = $override['model_id'] ?? null) || trim($id) === '' || trim($id) !== $id
                || ! is_string($multiplier = $override['multiplier'] ?? null)
                || self::decimal($multiplier) === null || isset($seen[$id])) {
                throw new InvalidArgumentException('Model overrides require unique model IDs and positive decimal multipliers');
            }
            $seen[$id] = true;
        }
        return $overrides;
    }

    /** 单价与汇率限制十二位精度，拒绝非法数值。 */
    private static function decimal(mixed $value, bool $allowZero = false, int $scale = 12, int $integerDigits = 12): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $decimal = is_string($value) || is_int($value) || is_float($value) ? (string) $value : '';
        if (! preg_match('/^\d{1,' . $integerDigits . '}(?:\.\d{1,' . $scale . '})?$/D', $decimal) || (! $allowZero && bccomp($decimal, '0', $scale) <= 0)) {
            throw new InvalidArgumentException('Model multiplier amounts must be valid decimals within the allowed precision');
        }
        return $decimal;
    }
}
