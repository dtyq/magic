<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Repository\Facade;

// 可以自由指定 extra 数据
interface MagicTokenExtraInterface
{
    public function getMagicEnvId(): ?int;

    public function setMagicEnvId(?int $magicEnvId): void;

    public function setTokenExtraData(array $extraData): self;

    public function toArray(): array;
}
