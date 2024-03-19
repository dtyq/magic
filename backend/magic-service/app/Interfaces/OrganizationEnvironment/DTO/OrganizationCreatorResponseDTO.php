<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\OrganizationEnvironment\DTO;

use App\Infrastructure\Core\AbstractDTO;

class OrganizationCreatorResponseDTO extends AbstractDTO
{
    public string $userId = '';

    public ?string $magicId = null;

    public string $name = '';

    public string $avatar = '';

    public ?string $email = null;

    public ?string $phone = null;

    public function setUserId(?string $userId): void
    {
        $this->userId = $userId ?? '';
    }

    public function setMagicId(?string $magicId): void
    {
        $this->magicId = $magicId;
    }

    public function setName(?string $name): void
    {
        $this->name = $name ?? '';
    }

    public function setAvatar(?string $avatar): void
    {
        $this->avatar = $avatar ?? '';
    }

    public function setEmail(?string $email): void
    {
        $this->email = $email;
    }

    public function setPhone(?string $phone): void
    {
        $this->phone = $phone;
    }
}
