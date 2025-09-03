<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\DTO\Traits\OperatorDTOTrait;

class ModelConfigDTO extends AbstractDTO
{
    use OperatorDTOTrait;

    public ?string $id = null;

    public ?string $model = null;

    public ?string $type = null;

    public ?string $name = null;

    public ?bool $enabled = true;

    public ?float $totalAmount = 0;

    public ?float $useAmount = 0;

    public ?float $exchangeRate = 8;

    public ?float $inputCostPer_1000 = 0;

    public ?float $outputCostPer_1000 = 0;

    public ?int $rpm = 0;

    public ?string $implementation;

    public ?array $implementationConfig = [];

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id ? (string) $id : null;
    }

    public function getModel(): ?string
    {
        return $this->model;
    }

    public function setModel(?string $model): void
    {
        $this->model = $model;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(?string $type): void
    {
        $this->type = $type;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name;
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getTotalAmount(): ?float
    {
        return $this->totalAmount;
    }

    public function setTotalAmount(?float $totalAmount): void
    {
        $this->totalAmount = $totalAmount;
    }

    public function getUseAmount(): ?float
    {
        return $this->useAmount;
    }

    public function setUseAmount(?float $useAmount): void
    {
        $this->useAmount = $useAmount;
    }

    public function getExchangeRate(): ?float
    {
        return $this->exchangeRate;
    }

    public function setExchangeRate(?float $exchangeRate): void
    {
        $this->exchangeRate = $exchangeRate;
    }

    public function getInputCostPer1000(): ?float
    {
        return $this->inputCostPer_1000;
    }

    public function setInputCostPer1000(?float $inputCostPer_1000): void
    {
        $this->inputCostPer_1000 = $inputCostPer_1000;
    }

    public function getOutputCostPer1000(): ?float
    {
        return $this->outputCostPer_1000;
    }

    public function setOutputCostPer1000(?float $outputCostPer_1000): void
    {
        $this->outputCostPer_1000 = $outputCostPer_1000;
    }

    public function getRpm(): ?int
    {
        return $this->rpm;
    }

    public function setRpm(?int $rpm): void
    {
        $this->rpm = $rpm;
    }

    public function getImplementation(): ?string
    {
        return $this->implementation;
    }

    public function setImplementation(?string $implementation): void
    {
        $this->implementation = $implementation;
    }

    public function getImplementationConfig(): ?array
    {
        return $this->implementationConfig;
    }

    public function setImplementationConfig(?array $implementationConfig): void
    {
        $this->implementationConfig = $implementationConfig;
    }
}
