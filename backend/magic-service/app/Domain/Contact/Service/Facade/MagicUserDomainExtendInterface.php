<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Service\Facade;

use App\Domain\Contact\DTO\UserUpdateDTO;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;

interface MagicUserDomainExtendInterface
{
    public function getUserUpdatePermission(DataIsolation $dataIsolation): array;

    public function updateUserInfo(DataIsolation $dataIsolation, UserUpdateDTO $userUpdateDTO): int;
}
