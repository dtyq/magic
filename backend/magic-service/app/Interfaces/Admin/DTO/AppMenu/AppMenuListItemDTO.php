<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\DTO\AppMenu;

use App\Domain\AppMenu\Entity\ValueObject\AppMenuIconType;
use App\Domain\AppMenu\Entity\ValueObject\AppMenuStatus;
use App\Domain\AppMenu\Entity\ValueObject\DisplayScope;
use App\Domain\AppMenu\Entity\ValueObject\OpenMethod;
use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\DTO\Traits\StringIdDTOTrait;

/**
 * 列表项 DTO，仅含数据库表字段，供 /api/v1/admin/applications/queries 使用.
 */
class AppMenuListItemDTO extends AbstractDTO
{
    use StringIdDTOTrait;

    public array $nameI18n = [];

    public string $icon = '';

    public string $iconUrl = '';

    public int $iconType = AppMenuIconType::Icon->value;

    public string $path = '';

    public int $openMethod = OpenMethod::CurrentWindow->value;

    public int $sortOrder = 0;

    public int $displayScope = DisplayScope::All->value;

    public int $status = AppMenuStatus::Enabled->value;

    public string $creatorId = '';

    public string $createdAt = '';

    public string $updatedAt = '';

    public function setNameI18n(?array $nameI18n): void
    {
        $this->nameI18n = $nameI18n ?? [];
    }

    public function setIcon(?string $icon): void
    {
        $this->icon = $icon ?? '';
    }

    public function setIconUrl(?string $iconUrl): void
    {
        $this->iconUrl = $iconUrl ?? '';
    }

    public function setIconType(null|int|string $iconType): void
    {
        $this->iconType = $iconType === null || $iconType === '' ? AppMenuIconType::Icon->value : AppMenuIconType::make((int) $iconType)->value;
    }

    public function setPath(?string $path): void
    {
        $this->path = $path ?? '';
    }

    public function setOpenMethod(null|int|string $openMethod): void
    {
        $this->openMethod = $openMethod === null || $openMethod === ''
            ? OpenMethod::CurrentWindow->value
            : OpenMethod::make((int) $openMethod)->value;
    }

    public function setSortOrder(null|int|string $sortOrder): void
    {
        $this->sortOrder = $sortOrder === null ? 0 : (int) $sortOrder;
    }

    public function setDisplayScope(null|int|string $displayScope): void
    {
        $this->displayScope = $displayScope === null || $displayScope === ''
            ? DisplayScope::All->value
            : DisplayScope::make((int) $displayScope)->value;
    }

    public function setStatus(null|int|string $status): void
    {
        $this->status = $status === null || $status === ''
            ? AppMenuStatus::Enabled->value
            : AppMenuStatus::make((int) $status)->value;
    }

    public function setCreatorId(?string $creatorId): void
    {
        $this->creatorId = $creatorId ?? '';
    }

    public function setCreatedAt(mixed $createdAt): void
    {
        $this->createdAt = $this->createDateTimeString($createdAt);
    }

    public function setUpdatedAt(mixed $updatedAt): void
    {
        $this->updatedAt = $this->createDateTimeString($updatedAt);
    }
}
