<?php

declare(strict_types=1);

namespace App\Interfaces\OrganizationEnvironment\DTO;

use App\Infrastructure\Core\AbstractDTO;

class OrganizationResponseDTO extends AbstractDTO
{
    public ?int $id = null;

    public string $magicOrganizationCode = '';

    public string $name = '';

    public int $status = 0;

    public int $type = 0;

    public ?int $seats = null;

    public ?string $syncType = null;

    public ?int $syncStatus = null;

    public string $syncTime = '';

    public string $createdAt = '';

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function setMagicOrganizationCode(string $magicOrganizationCode): void
    {
        $this->magicOrganizationCode = $magicOrganizationCode;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function setStatus(int $status): void
    {
        $this->status = $status;
    }

    public function setType(int $type): void
    {
        $this->type = $type;
    }

    public function setSeats(?int $seats): void
    {
        $this->seats = $seats;
    }

    public function setSyncType(?string $syncType): void
    {
        $this->syncType = $syncType;
    }

    public function setSyncStatus(?int $syncStatus): void
    {
        $this->syncStatus = $syncStatus;
    }

    public function setSyncTime(string $syncTime): void
    {
        $this->syncTime = $syncTime;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }
}


