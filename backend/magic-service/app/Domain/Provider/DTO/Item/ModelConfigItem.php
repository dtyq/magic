<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class ModelConfigItem extends AbstractDTO
{
    protected ?int $maxTokens = null;

    protected bool $supportFunction = false;

    protected bool $supportDeepThink = false;

    protected int $vectorSize = 2048;

    protected bool $supportMultiModal = false;

    protected bool $supportEmbedding = false;

    protected ?int $maxOutputTokens = null;

    protected ?float $creativity = null;

    protected ?float $temperature = null;

    protected ?string $billingCurrency = null;

    protected BillingType $billingType = BillingType::Tokens;

    protected ?string $inputPricing = null;

    protected ?string $outputPricing = null;

    protected ?string $cacheWritePricing = null;

    protected ?string $cacheHitPricing = null;

    protected bool $officialRecommended = false;

    protected ?string $timePricing = null;

    protected ?string $inputCost = null;

    protected ?string $outputCost = null;

    protected ?string $cacheHitCost = null;

    protected ?string $cacheWriteCost = null;

    protected ?string $timeCost = null;

    public function getMaxTokens(): ?int
    {
        return $this->maxTokens;
    }

    public function setMaxTokens(null|int|string $maxTokens): void
    {
        if ($maxTokens === null) {
            $this->maxTokens = null;
        } else {
            $this->maxTokens = (int) $maxTokens;
        }
    }

    public function getVectorSize(): int
    {
        return $this->vectorSize;
    }

    public function setVectorSize(null|int|string $vectorSize): void
    {
        if ($vectorSize === null) {
            $this->vectorSize = 2048;
        } else {
            $this->vectorSize = (int) $vectorSize;
        }
    }

    public function isSupportMultiModal(): bool
    {
        return $this->supportMultiModal;
    }

    public function setSupportMultiModal(null|bool|int|string $supportMultiModal): void
    {
        $this->supportMultiModal = $this->parseBooleanValue($supportMultiModal);
    }

    public function isSupportEmbedding(): bool
    {
        return $this->supportEmbedding;
    }

    public function setSupportEmbedding(null|bool|int|string $supportEmbedding): void
    {
        $this->supportEmbedding = $this->parseBooleanValue($supportEmbedding);
    }

    public function isSupportFunction(): bool
    {
        return $this->supportFunction;
    }

    public function setSupportFunction(null|bool|int|string $supportFunction): void
    {
        $this->supportFunction = $this->parseBooleanValue($supportFunction);
    }

    public function isSupportDeepThink(): bool
    {
        return $this->supportDeepThink;
    }

    public function setSupportDeepThink(null|bool|int|string $supportDeepThink): void
    {
        $this->supportDeepThink = $this->parseBooleanValue($supportDeepThink);
    }

    public function isRecommended(): bool
    {
        return $this->isRecommended;
    }

    public function setIsRecommended(bool $isRecommended): void
    {
        $this->isRecommended = $isRecommended;
    }

    public function getMaxOutputTokens(): ?int
    {
        return $this->maxOutputTokens;
    }

    public function getCreativity(): ?float
    {
        return $this->creativity;
    }

    public function getTemperature(): ?float
    {
        return $this->temperature;
    }

    public function getBillingCurrency(): ?string
    {
        return $this->billingCurrency;
    }

    public function getInputPricing(): ?string
    {
        return $this->inputPricing;
    }

    public function getOutputPricing(): ?string
    {
        return $this->outputPricing;
    }

    public function getCacheWritePricing(): ?string
    {
        return $this->cacheWritePricing;
    }

    public function getCacheHitPricing(): ?string
    {
        return $this->cacheHitPricing;
    }

    public function isOfficialRecommended(): bool
    {
        return $this->officialRecommended;
    }

    public function setMaxOutputTokens(?int $maxOutputTokens): void
    {
        $this->maxOutputTokens = $maxOutputTokens;
    }

    public function setCreativity(?float $creativity): void
    {
        if ($creativity !== null && ($creativity < 0 || $creativity > 2)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.creativity_value_range_error');
        }

        $this->creativity = $creativity;
        $this->handleCreativityAndTemperatureConflict();
    }

    public function setTemperature(?float $temperature): void
    {
        if ($temperature !== null && ($temperature < 0 || $temperature > 2)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.temperature_value_range_error');
        }

        $this->temperature = $temperature;
        $this->handleCreativityAndTemperatureConflict();
    }

    public function setBillingCurrency(?string $billingCurrency): void
    {
        if ($billingCurrency === null) {
            $this->billingCurrency = null;
        } else {
            $currency = strtoupper(trim((string) $billingCurrency));
            if (in_array($currency, ['CNY', 'USD'])) {
                $this->billingCurrency = $currency;
            } else {
                $this->billingCurrency = null;
            }
        }
    }

    public function setInputPricing(null|float|string $inputPricing): void
    {
        $this->inputPricing = $this->validateAndSetPricing($inputPricing);
    }

    public function setOutputPricing(null|float|string $outputPricing): void
    {
        $this->outputPricing = $this->validateAndSetPricing($outputPricing);
    }

    public function setCacheWritePricing(null|float|string $cacheWritePricing): void
    {
        $this->cacheWritePricing = $this->validateAndSetPricing($cacheWritePricing);
    }

    public function setCacheHitPricing(null|float|string $cacheHitPricing): void
    {
        $this->cacheHitPricing = $this->validateAndSetPricing($cacheHitPricing);
    }

    public function setOfficialRecommended(bool $officialRecommended): void
    {
        $this->officialRecommended = $officialRecommended;
    }

    public function getBillingType(): BillingType
    {
        return $this->billingType;
    }

    public function setBillingType(BillingType|string $billingType): void
    {
        $this->billingType = $billingType instanceof BillingType ? $billingType : BillingType::tryFrom($billingType) ?? BillingType::Tokens;
    }

    public function getTimePricing(): ?string
    {
        return $this->timePricing;
    }

    public function setTimePricing(?string $timePricing): void
    {
        $this->timePricing = $timePricing;
    }

    public function getInputCost(): ?string
    {
        return $this->inputCost;
    }

    public function setInputCost(null|float|string $inputCost): void
    {
        $this->inputCost = $this->validateAndSetPricing($inputCost);
    }

    public function getOutputCost(): ?string
    {
        return $this->outputCost;
    }

    public function setOutputCost(null|float|string $outputCost): void
    {
        $this->outputCost = $this->validateAndSetPricing($outputCost);
    }

    public function getCacheHitCost(): ?string
    {
        return $this->cacheHitCost;
    }

    public function setCacheHitCost(null|float|string $cacheHitCost): void
    {
        $this->cacheHitCost = $this->validateAndSetPricing($cacheHitCost);
    }

    public function getCacheWriteCost(): ?string
    {
        return $this->cacheWriteCost;
    }

    public function setCacheWriteCost(null|float|string $cacheWriteCost): void
    {
        $this->cacheWriteCost = $this->validateAndSetPricing($cacheWriteCost);
    }

    public function getTimeCost(): ?string
    {
        return $this->timeCost;
    }

    public function setTimeCost(null|float|string $timeCost): void
    {
        $this->timeCost = $this->validateAndSetPricing($timeCost);
    }

    private function handleCreativityAndTemperatureConflict(): void
    {
        if ($this->creativity !== null && $this->temperature !== null) {
            // 优先保留 temperature，将 creativity 设为 null
            $this->creativity = null;
        }
    }

    /**
     * 解析布尔值（统一处理逻辑）.
     */
    private function parseBooleanValue(null|bool|int|string $value): bool
    {
        if ($value === null) {
            return false;
        }

        if (is_string($value)) {
            return in_array(strtolower($value), ['true', '1', 'yes', 'on'], true);
        }

        return (bool) $value;
    }

    /**
     * 验证并设置价格/成本（统一处理逻辑）.
     */
    private function validateAndSetPricing(null|float|string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $numericValue = (float) $value;
        if ($numericValue < 0) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidPricing);
        }

        return (string) $value;
    }
}
