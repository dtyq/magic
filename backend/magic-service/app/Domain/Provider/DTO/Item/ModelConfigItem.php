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
}
