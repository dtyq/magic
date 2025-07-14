<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Agent\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\DTO\Traits\StringIdDTOTrait;

class AvailableAgentDTO extends AbstractDTO
{
    use StringIdDTOTrait;

    /**
     * 助理名称.
     */
    public string $name;

    /**
     * 助理头像.
     */
    public string $avatar;

    /**
     * 助理描述.
     */
    public string $description;

    /**
     * 创建时间.
     */
    public ?string $createdAt = null;

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getAvatar(): string
    {
        return $this->avatar;
    }

    public function setAvatar(string $avatar): void
    {
        $this->avatar = $avatar;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }
}
