<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

use App\Infrastructure\Core\AbstractDTO;

class ModelConfigItem extends AbstractDTO
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

    public function setMaxTokens(int|string|null $maxTokens): void
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

    public function setVectorSize(int|string|null $vectorSize): void
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

    public function setSupportMultiModal(bool|int|string|null $supportMultiModal): void
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

    public function setSupportEmbedding(bool|int|string|null $supportEmbedding): void
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

    public function setSupportFunction(bool|int|string|null $supportFunction): void
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

    public function setSupportDeepThink(bool|int|string|null $supportDeepThink): void
    {
        if ($supportDeepThink === null) {
            $this->supportDeepThink = false;
        } elseif (is_string($supportDeepThink)) {
            $this->supportDeepThink = in_array(strtolower($supportDeepThink), ['true', '1', 'yes', 'on']);
        } else {
            $this->supportDeepThink = (bool) $supportDeepThink;
        }
    }
}
