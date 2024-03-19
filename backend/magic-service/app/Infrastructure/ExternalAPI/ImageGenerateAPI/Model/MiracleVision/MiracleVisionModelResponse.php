<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractEntity;

class MiracleVisionModelResponse extends AbstractEntity
{
    // 完成状态
    protected bool $finishStatus = false;

    // 图片
    protected array $urls = [];

    // 进度条
    protected float $progress = 0;

    protected string $error = '';

    public function setError(string $error): void
    {
        $this->error = $error;
    }

    public function getError(): string
    {
        return $this->error;
    }

    public function isFinishStatus(): bool
    {
        return $this->finishStatus;
    }

    public function setFinishStatus(bool $finishStatus): void
    {
        $this->finishStatus = $finishStatus;
    }

    public function getUrls(): array
    {
        return $this->urls;
    }

    public function setUrls(array $urls): void
    {
        $this->urls = $urls;
    }

    public function getProgress(): float
    {
        return $this->progress;
    }

    public function setProgress(float $progress): void
    {
        $this->progress = $progress;
    }
}
