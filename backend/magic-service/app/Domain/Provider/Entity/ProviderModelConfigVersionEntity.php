<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity;

use App\Infrastructure\Core\AbstractEntity;

class ProviderModelConfigVersionEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected int $serviceProviderModelId;

    protected float $creativity = 0.5;

    protected ?int $maxTokens = null;

    protected ?float $temperature = null;

    protected int $vectorSize = 2048;

    protected ?string $billingType = null;

    protected ?float $timePricing = null;

    protected ?float $inputPricing = null;

    protected ?float $outputPricing = null;

    protected ?string $billingCurrency = null;

    protected bool $supportFunction = false;

    protected ?float $cacheHitPricing = null;

    protected ?int $maxOutputTokens = null;

    protected bool $supportEmbedding = false;

    protected bool $supportDeepThink = false;

    protected ?float $cacheWritePricing = null;

    protected bool $supportMultiModal = false;

    protected bool $officialRecommended = false;

    protected ?float $inputCost = null;

    protected ?float $outputCost = null;

    protected ?float $cacheHitCost = null;

    protected ?float $cacheWriteCost = null;

    protected ?float $timeCost = null;

    protected int $version = 1;

    protected bool $isCurrentVersion = true;

    protected ?string $createdAt = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getServiceProviderModelId(): int
    {
        return $this->serviceProviderModelId;
    }

    public function setServiceProviderModelId(int $serviceProviderModelId): void
    {
        $this->serviceProviderModelId = $serviceProviderModelId;
    }

    public function getVersion(): int
    {
        return $this->version;
    }

    public function setVersion(int $version): void
    {
        $this->version = $version;
    }

    public function isCurrentVersion(): bool
    {
        return $this->isCurrentVersion;
    }

    public function setIsCurrentVersion(bool $isCurrentVersion): void
    {
        $this->isCurrentVersion = $isCurrentVersion;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getCreativity(): float
    {
        return $this->creativity;
    }

    public function setCreativity(null|float|int|string $creativity): void
    {
        if ($creativity === null) {
            $this->creativity = 0.5;
        } else {
            $this->creativity = (float) $creativity;
        }
    }

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

    public function getTemperature(): ?float
    {
        return $this->temperature;
    }

    public function setTemperature(null|float|int|string $temperature): void
    {
        if ($temperature === null || $temperature === '') {
            $this->temperature = null;
        } else {
            $this->temperature = (float) $temperature;
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

    public function getBillingType(): ?string
    {
        return $this->billingType;
    }

    public function setBillingType(?string $billingType): void
    {
        $this->billingType = $billingType;
    }

    public function getTimePricing(): ?float
    {
        return $this->timePricing;
    }

    public function setTimePricing(null|float|int|string $timePricing): void
    {
        if ($timePricing === null || $timePricing === '') {
            $this->timePricing = null;
        } else {
            $this->timePricing = (float) $timePricing;
        }
    }

    public function getInputPricing(): ?float
    {
        return $this->inputPricing;
    }

    public function setInputPricing(null|float|int|string $inputPricing): void
    {
        if ($inputPricing === null || $inputPricing === '') {
            $this->inputPricing = null;
        } else {
            $this->inputPricing = (float) $inputPricing;
        }
    }

    public function getOutputPricing(): ?float
    {
        return $this->outputPricing;
    }

    public function setOutputPricing(null|float|int|string $outputPricing): void
    {
        if ($outputPricing === null || $outputPricing === '') {
            $this->outputPricing = null;
        } else {
            $this->outputPricing = (float) $outputPricing;
        }
    }

    public function getBillingCurrency(): ?string
    {
        return $this->billingCurrency;
    }

    public function setBillingCurrency(?string $billingCurrency): void
    {
        $this->billingCurrency = $billingCurrency;
    }

    public function isSupportFunction(): bool
    {
        return $this->supportFunction;
    }

    public function setSupportFunction(null|bool|int|string $supportFunction): void
    {
        if ($supportFunction === null) {
            $this->supportFunction = false;
        } else {
            $this->supportFunction = (bool) $supportFunction;
        }
    }

    public function getCacheHitPricing(): ?float
    {
        return $this->cacheHitPricing;
    }

    public function setCacheHitPricing(null|float|int|string $cacheHitPricing): void
    {
        if ($cacheHitPricing === null || $cacheHitPricing === '') {
            $this->cacheHitPricing = null;
        } else {
            $this->cacheHitPricing = (float) $cacheHitPricing;
        }
    }

    public function getMaxOutputTokens(): ?int
    {
        return $this->maxOutputTokens;
    }

    public function setMaxOutputTokens(null|int|string $maxOutputTokens): void
    {
        if ($maxOutputTokens === null) {
            $this->maxOutputTokens = null;
        } else {
            $this->maxOutputTokens = (int) $maxOutputTokens;
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
        } else {
            $this->supportEmbedding = (bool) $supportEmbedding;
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
        } else {
            $this->supportDeepThink = (bool) $supportDeepThink;
        }
    }

    public function getCacheWritePricing(): ?float
    {
        return $this->cacheWritePricing;
    }

    public function setCacheWritePricing(null|float|int|string $cacheWritePricing): void
    {
        if ($cacheWritePricing === null || $cacheWritePricing === '') {
            $this->cacheWritePricing = null;
        } else {
            $this->cacheWritePricing = (float) $cacheWritePricing;
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
        } else {
            $this->supportMultiModal = (bool) $supportMultiModal;
        }
    }

    public function isOfficialRecommended(): bool
    {
        return $this->officialRecommended;
    }

    public function setOfficialRecommended(null|bool|int|string $officialRecommended): void
    {
        if ($officialRecommended === null) {
            $this->officialRecommended = false;
        } else {
            $this->officialRecommended = (bool) $officialRecommended;
        }
    }

    public function getInputCost(): ?float
    {
        return $this->inputCost;
    }

    public function setInputCost(null|float|int|string $inputCost): void
    {
        if ($inputCost === null || $inputCost === '') {
            $this->inputCost = null;
        } else {
            $this->inputCost = (float) $inputCost;
        }
    }

    public function getOutputCost(): ?float
    {
        return $this->outputCost;
    }

    public function setOutputCost(null|float|int|string $outputCost): void
    {
        if ($outputCost === null || $outputCost === '') {
            $this->outputCost = null;
        } else {
            $this->outputCost = (float) $outputCost;
        }
    }

    public function getCacheHitCost(): ?float
    {
        return $this->cacheHitCost;
    }

    public function setCacheHitCost(null|float|int|string $cacheHitCost): void
    {
        if ($cacheHitCost === null || $cacheHitCost === '') {
            $this->cacheHitCost = null;
        } else {
            $this->cacheHitCost = (float) $cacheHitCost;
        }
    }

    public function getCacheWriteCost(): ?float
    {
        return $this->cacheWriteCost;
    }

    public function setCacheWriteCost(null|float|int|string $cacheWriteCost): void
    {
        if ($cacheWriteCost === null || $cacheWriteCost === '') {
            $this->cacheWriteCost = null;
        } else {
            $this->cacheWriteCost = (float) $cacheWriteCost;
        }
    }

    public function getTimeCost(): ?float
    {
        return $this->timeCost;
    }

    public function setTimeCost(null|float|int|string $timeCost): void
    {
        if ($timeCost === null || $timeCost === '') {
            $this->timeCost = null;
        } else {
            $this->timeCost = (float) $timeCost;
        }
    }
}
