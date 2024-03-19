<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Agent;

use App\Infrastructure\Core\AbstractDTO;

class SenderExtraDTO extends AbstractDTO
{
    protected ?int $magicEnvId = null;

    public function getMagicEnvId(): ?int
    {
        return $this->magicEnvId;
    }

    public function setMagicEnvId(?int $magicEnvId): self
    {
        $this->magicEnvId = $magicEnvId;
        return $this;
    }
}
