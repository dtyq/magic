<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class TextGenerateImageDTO extends AbstractRequestDTO
{
    protected string $prompt = '';

    protected string $size = '';

    protected int $n = 1;

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function setPrompt(string $prompt): void
    {
        $this->prompt = $prompt;
    }

    public function getSize(): string
    {
        return $this->size;
    }

    public function setSize(string $size): void
    {
        $this->size = $size;
    }

    public function getN(): int
    {
        return $this->n;
    }

    public function setN(int $n): void
    {
        $this->n = $n;
    }

    public function getType(): string
    {
        return 'image';
    }

    public function valid()
    {
        if ($this->model === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'model_field']);
        }

        if ($this->size === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'size_filed']);
        }

        if ($this->n < 1 || $this->n > 4) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.invalid_range', ['label' => 'Number of images', 'min' => 1, 'max' => 4]);
        }
    }
}
