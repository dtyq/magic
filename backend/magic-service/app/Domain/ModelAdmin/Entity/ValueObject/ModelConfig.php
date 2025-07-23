<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Entity\ValueObject;

use App\Infrastructure\Core\AbstractDTO;

class ModelConfig extends AbstractDTO
{
    protected ?int $maxTokens = null;

    protected bool $supportFunction = false;

    protected bool $supportDeepThink = false;

    protected int $vectorSize = 2048;

    protected bool $supportMultiModal = false;

    protected bool $supportEmbedding = false;

    public function getMaxTokens(): ?int
    {
        return $this->maxTokens;
    }

    public function setMaxTokens(?int $maxTokens): void
    {
        $this->maxTokens = $maxTokens;
    }

    public function getVectorSize(): int
    {
        return $this->vectorSize;
    }

    public function setVectorSize(int $vectorSize): void
    {
        $this->vectorSize = $vectorSize;
    }

    public function isSupportMultiModal(): bool
    {
        return $this->supportMultiModal;
    }

    public function setSupportMultiModal(bool $supportMultiModal): void
    {
        $this->supportMultiModal = $supportMultiModal;
    }

    public function isSupportEmbedding(): bool
    {
        return $this->supportEmbedding;
    }

    public function setSupportEmbedding(bool $supportEmbedding): void
    {
        $this->supportEmbedding = $supportEmbedding;
    }

    public function isSupportFunction(): bool
    {
        return $this->supportFunction;
    }

    public function setSupportFunction(bool $supportFunction): void
    {
        $this->supportFunction = $supportFunction;
    }

    public function isSupportDeepThink(): bool
    {
        return $this->supportDeepThink;
    }

    public function setSupportDeepThink(bool $supportDeepThink): void
    {
        $this->supportDeepThink = $supportDeepThink;
    }
}
