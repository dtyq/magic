<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Item;

use App\Domain\Token\Entity\AbstractEntity;
use App\Domain\Token\Repository\Facade\MagicTokenExtraInterface;

class MagicTokenExtra extends AbstractEntity implements MagicTokenExtraInterface
{
    protected ?int $magicEnvId = null;

    public function getMagicEnvId(): ?int
    {
        return $this->magicEnvId;
    }

    public function setMagicEnvId(?int $magicEnvId): void
    {
        $this->magicEnvId = $magicEnvId;
    }

    public function setTokenExtraData(array $extraData): self
    {
        if (isset($extraData['magic_env_id'])) {
            $this->setMagicEnvId($extraData['magic_env_id']);
        }
        return $this;
    }
}
