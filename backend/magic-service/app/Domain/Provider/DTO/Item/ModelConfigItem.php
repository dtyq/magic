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

    protected float $creativity = 0.5;

    protected float $temperature = 0.7;

    protected ?string $billingCurrency = null;

    protected ?string $inputPricing = null;

    protected ?string $outputPricing = null;

    protected ?string $cacheWritePricing = null;

    protected ?string $cacheHitPricing = null;

    protected bool $officialRecommended = false;

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
        if ($supportMultiModal === null) {
            $this->supportMultiModal = false;
        } elseif (is_string($supportMultiModal)) {
            $this->supportMultiModal = in_array(strtolower($supportMultiModal), ['true', '1', 'yes', 'on']);
        } else {
            $this->supportMultiModal = (bool) $supportMultiModal;
        }
    }

    public function isSupportEmbedding(): bool
    {
        return $this->supportEmbedding;
    }

    public function setSupportEmbedding(null|bool|int|string $supportEmbedding): void
    {
        if ($supportEmbedding === null) {
            $this->supportEmbedding = false;
        } elseif (is_string($supportEmbedding)) {
            $this->supportEmbedding = in_array(strtolower($supportEmbedding), ['true', '1', 'yes', 'on']);
        } else {
            $this->supportEmbedding = (bool) $supportEmbedding;
        }
    }

    public function isSupportFunction(): bool
    {
        return $this->supportFunction;
    }

    public function setSupportFunction(null|bool|int|string $supportFunction): void
    {
        if ($supportFunction === null) {
            $this->supportFunction = false;
        } elseif (is_string($supportFunction)) {
            $this->supportFunction = in_array(strtolower($supportFunction), ['true', '1', 'yes', 'on']);
        } else {
            $this->supportFunction = (bool) $supportFunction;
        }
    }

    public function isSupportDeepThink(): bool
    {
        return $this->supportDeepThink;
    }

    public function setSupportDeepThink(null|bool|int|string $supportDeepThink): void
    {
        if ($supportDeepThink === null) {
            $this->supportDeepThink = false;
        } elseif (is_string($supportDeepThink)) {
            $this->supportDeepThink = in_array(strtolower($supportDeepThink), ['true', '1', 'yes', 'on']);
        } else {
            $this->supportDeepThink = (bool) $supportDeepThink;
        }
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

    public function getCreativity(): float
    {
        return $this->creativity;
    }

    public function getTemperature(): float
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
        if ($creativity === null) {
            $this->creativity = 0.5;
        } elseif ($creativity < 0 || $creativity > 2) {
            $this->creativity = 0.5;
        } else {
            $this->creativity = $creativity;
        }
    }

    public function setTemperature(?float $temperature): void
    {
        if ($temperature === null) {
            $this->temperature = 0.7;
        } elseif ($temperature < 0 || $temperature > 2) {
            $this->temperature = 0.7;
        } else {
            $this->temperature = $temperature;
        }
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
        if ($inputPricing === null) {
            $this->inputPricing = null;
        } else {
            $pricing = (float) $inputPricing;
            if ($pricing < 0) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidPricing);
            }
            $this->inputPricing = (string) $inputPricing;
        }
    }

    public function setOutputPricing(null|float|string $outputPricing): void
    {
        if ($outputPricing === null) {
            $this->outputPricing = null;
        } else {
            $pricing = (float) $outputPricing;
            if ($pricing < 0) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidPricing);
            }
            $this->outputPricing = (string) $outputPricing;
        }
    }

    public function setCacheWritePricing(null|float|string $cacheWritePricing): void
    {
        if ($cacheWritePricing === null) {
            $this->cacheWritePricing = null;
        } else {
            $pricing = (float) $cacheWritePricing;
            if ($pricing < 0) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidPricing);
            }
            $this->cacheWritePricing = (string) $cacheWritePricing;
        }
    }

    public function setCacheHitPricing(null|float|string $cacheHitPricing): void
    {
        if ($cacheHitPricing === null) {
            $this->cacheHitPricing = null;
        } else {
            $pricing = (float) $cacheHitPricing;
            if ($pricing < 0) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidPricing);
            }
            $this->cacheHitPricing = (string) $cacheHitPricing;
        }
    }

    public function setOfficialRecommended(bool $officialRecommended): void
    {
        $this->officialRecommended = $officialRecommended;
    }
}
