<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity;

use App\Domain\ModelGateway\Entity\ValueObject\Amount;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

use function Hyperf\Support\env;

class ModelConfigEntity extends AbstractEntity
{
    protected ?int $id = null;

    /**
     * 服务商侧接入点 id.比如火山的：ep-xxxx.
     */
    protected string $model;

    /**
     * 模型类型.比如：gtp4o.
     */
    protected string $type;

    protected string $name;

    protected bool $enabled = true;

    protected float $totalAmount = 0;

    protected float $useAmount = 0;

    protected float $exchangeRate = 8;

    protected float $inputCostPer_1000 = 0;

    protected float $outputCostPer_1000 = 0;

    protected int $rpm = 0;

    protected string $implementation;

    protected array $implementationConfig = [];

    protected DateTime $createdAt;

    protected DateTime $updatedAt;

    private ?array $actualImplementationConfig = null;

    private array $info = [];

    private string $ownerBy = '';

    private string $object = 'model';  // Default to 'model', can be 'image' for image generation models

    public function __construct(?array $data = null)
    {
        parent::__construct($data);
    }

    public function prepareForSaving(): void
    {
        if (empty($this->model)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'model']);
        }
        if (empty($this->name)) {
            $this->name = $this->model;
        }
        if (empty($this->implementation)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'implementation']);
        }
        if (class_exists($this->implementation) === false) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.not_found', ['label' => 'implementation']);
        }
    }

    public function checkRpm(): void
    {
        // 目前不限制
    }

    public function calculateInputCost(int $inputTokens, int $outputTokens): string
    {
        return bcadd(
            Amount::calculateCost($inputTokens, $this->inputCostPer_1000, $this->exchangeRate),
            Amount::calculateCost($outputTokens, $this->outputCostPer_1000, $this->exchangeRate),
            Amount::Scale
        );
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(string $model): void
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

    public function getTotalAmount(): float
    {
        return $this->totalAmount;
    }

    public function setTotalAmount(float $totalAmount): void
    {
        $this->totalAmount = $totalAmount;
    }

    public function getUseAmount(): float
    {
        return $this->useAmount;
    }

    public function setUseAmount(float $useAmount): void
    {
        $this->useAmount = $useAmount;
    }

    public function getRpm(): int
    {
        return $this->rpm;
    }

    public function setRpm(int $rpm): void
    {
        $this->rpm = $rpm;
    }

    public function getExchangeRate(): float
    {
        return $this->exchangeRate;
    }

    public function setExchangeRate(float $exchangeRate): void
    {
        $this->exchangeRate = $exchangeRate;
    }

    public function getInputCostPer1000(): float
    {
        return $this->inputCostPer_1000;
    }

    public function setInputCostPer1000(float $inputCostPer_1000): void
    {
        $this->inputCostPer_1000 = $inputCostPer_1000;
    }

    public function getOutputCostPer1000(): float
    {
        return $this->outputCostPer_1000;
    }

    public function setOutputCostPer1000(float $outputCostPer_1000): void
    {
        $this->outputCostPer_1000 = $outputCostPer_1000;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getInfo(): array
    {
        return $this->info;
    }

    public function setInfo(array $info): void
    {
        $this->info = $info;
    }

    public function getOwnerBy(): string
    {
        return $this->ownerBy;
    }

    public function setOwnerBy(string $ownerBy): void
    {
        $this->ownerBy = $ownerBy;
    }

    public function getImplementation(): string
    {
        return $this->implementation;
    }

    public function setImplementation(string $implementation): void
    {
        $this->implementation = $implementation;
    }

    public function getImplementationConfig(): array
    {
        return $this->implementationConfig;
    }

    public function setImplementationConfig(array $implementationConfig): void
    {
        $this->implementationConfig = $implementationConfig;
    }

    public function setActualImplementationConfig(?array $actualImplementationConfig): void
    {
        $this->actualImplementationConfig = $actualImplementationConfig;
    }

    public function getActualImplementationConfig(): array
    {
        if (! is_null($this->actualImplementationConfig)) {
            return $this->actualImplementationConfig;
        }
        // 从配置中获取实际的配置
        $configs = [];
        foreach ($this->implementationConfig as $index => $item) {
            $item = explode('|', $item);
            $key = $item[0] ?? '';
            $default = $item[1] ?? null;
            if (empty($key)) {
                continue;
            }
            $value = trim((string) env($key, $default) ?? '');
            if (empty($value)) {
                $value = $default;
            }
            $configs[$index] = $value;
        }
        return $configs;
    }

    public function getObject(): string
    {
        return $this->object;
    }

    public function setObject(string $object): void
    {
        $this->object = $object;
    }
}
