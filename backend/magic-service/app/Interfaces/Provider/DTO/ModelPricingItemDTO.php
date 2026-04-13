<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 模型价格信息项 DTO.
 */
class ModelPricingItemDTO extends AbstractDTO
{
    protected string $modelId = '';

    protected string $modelName = '';

    protected string $billingType = '';

    protected ?int $inputPoints = null;

    protected ?int $outputPoints = null;

    protected ?int $timePoints = null;

    protected ?int $secondPoints = null;

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(string $modelId): void
    {
        $this->modelId = $modelId;
    }

    public function getModelName(): string
    {
        return $this->modelName;
    }

    public function setModelName(string $modelName): void
    {
        $this->modelName = $modelName;
    }

    public function getBillingType(): string
    {
        return $this->billingType;
    }

    public function setBillingType(string $billingType): void
    {
        $this->billingType = $billingType;
    }

    public function getInputPoints(): ?int
    {
        return $this->inputPoints;
    }

    public function setInputPoints(?int $inputPoints): void
    {
        $this->inputPoints = $inputPoints;
    }

    public function getOutputPoints(): ?int
    {
        return $this->outputPoints;
    }

    public function setOutputPoints(?int $outputPoints): void
    {
        $this->outputPoints = $outputPoints;
    }

    public function getTimePoints(): ?int
    {
        return $this->timePoints;
    }

    public function setTimePoints(?int $timePoints): void
    {
        $this->timePoints = $timePoints;
    }

    public function getSecondPoints(): ?int
    {
        return $this->secondPoints;
    }

    public function setSecondPoints(?int $secondPoints): void
    {
        $this->secondPoints = $secondPoints;
    }
}
