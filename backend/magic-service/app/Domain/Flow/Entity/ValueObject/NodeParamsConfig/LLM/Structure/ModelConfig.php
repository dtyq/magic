<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class ModelConfig
{
    public function __construct(
        private readonly bool $autoMemory = true,
        private readonly int $maxRecord = 50,
        private readonly float $temperature = 0.5,
        private bool $vision = true,
        private string $visionModel = '',
    ) {
        if ($this->maxRecord < 0 || $this->maxRecord > 500) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.model_config.max_record_error');
        }
        if ($this->temperature < 0 || $this->temperature > 1) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.model_config.temperature_error');
        }
    }

    public function isAutoMemory(): bool
    {
        return $this->autoMemory;
    }

    public function getMaxRecord(): int
    {
        return $this->maxRecord;
    }

    public function getTemperature(): float
    {
        return $this->temperature;
    }

    public function isVision(): bool
    {
        return $this->vision;
    }

    public function getVisionModel(): string
    {
        return $this->visionModel;
    }

    public function getLLMChatConfig(): array
    {
        return [
            'auto_memory' => $this->autoMemory,
            'max_record' => $this->maxRecord,
            'temperature' => $this->temperature,
            'vision' => $this->vision,
            'vision_model' => $this->visionModel,
        ];
    }

    public function getLLMCallConfig(): array
    {
        return [
            'temperature' => $this->temperature,
        ];
    }

    public function setVision(bool $vision): void
    {
        $this->vision = $vision;
    }

    public function setVisionModel(string $visionModel): void
    {
        $this->visionModel = $visionModel;
    }
}
