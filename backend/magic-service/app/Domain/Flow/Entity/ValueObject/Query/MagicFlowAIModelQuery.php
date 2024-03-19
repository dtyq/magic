<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\Query;

class MagicFlowAIModelQuery extends Query
{
    public ?bool $enabled = null;

    public ?bool $supportEmbedding = null;

    public ?bool $display = null;

    public function getDisplay(): ?bool
    {
        return $this->display;
    }

    public function setDisplay(?bool $display): void
    {
        $this->display = $display;
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getSupportEmbedding(): ?bool
    {
        return $this->supportEmbedding;
    }

    public function setSupportEmbedding(?bool $supportEmbedding): void
    {
        $this->supportEmbedding = $supportEmbedding;
    }
}
