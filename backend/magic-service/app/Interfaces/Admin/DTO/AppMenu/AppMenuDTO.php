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
use App\Interfaces\Kernel\DTO\Traits\OperatorDTOTrait;
use App\Interfaces\Kernel\DTO\Traits\StringIdDTOTrait;

class AppMenuDTO extends AbstractDTO
{
    use OperatorDTOTrait;
    use StringIdDTOTrait;

    /**
     * 应用名称（多语言）.
     */
    public array $nameI18n = [];

    /**
     * 应用图标.
     */
    public string $icon = '';

    /**
     * 应用图标图片地址.
     */
    public string $iconUrl = '';

    /**
     * 图标类型: 1-图标, 2-图片.
     */
    public int $iconType = AppMenuIconType::Icon->value;

    /**
     * 应用路径（菜单链接）.
     */
    public string $path = '';

    /**
     * 打开方式: 1-当前窗口, 2-新窗口（见 OpenMethod 枚举）.
     */
    public int $openMethod = OpenMethod::CurrentWindow->value;

    /**
     * 排序（展示优先级，数值越大越靠前）.
     */
    public int $sortOrder = 0;

    /**
     * 可见范围: 0-仅企业/团队, 1-仅个人, 2-所有可见（见 DisplayScope 枚举）.
     */
    public int $displayScope = DisplayScope::All->value;

    /**
     * 状态: 1-正常, 2-禁用（见 AppMenuStatus 枚举）.
     */
    public int $status = AppMenuStatus::Enabled->value;

    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(?array $nameI18n): void
    {
        $this->nameI18n = $nameI18n ?? [];
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): void
    {
        $this->icon = $icon ?? '';
    }

    public function getIconUrl(): string
    {
        return $this->iconUrl;
    }

    public function setIconUrl(?string $iconUrl): void
    {
        $this->iconUrl = $iconUrl ?? '';
    }

    public function getIconType(): int
    {
        return $this->iconType;
    }

    public function setIconType(null|int|string $iconType): void
    {
        if ($iconType === null || $iconType === '') {
            $this->iconType = AppMenuIconType::Icon->value;
            return;
        }

        $this->iconType = AppMenuIconType::make((int) $iconType)->value;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function setPath(?string $path): void
    {
        $this->path = $path ?? '';
    }

    public function getOpenMethod(): int
    {
        return $this->openMethod;
    }

    public function setOpenMethod(null|int|string $openMethod): void
    {
        $this->openMethod = $openMethod === null || $openMethod === ''
            ? OpenMethod::CurrentWindow->value
            : OpenMethod::make((int) $openMethod)->value;
    }

    public function getSortOrder(): int
    {
        return $this->sortOrder;
    }

    public function setSortOrder(null|int|string $sortOrder): void
    {
        $this->sortOrder = $sortOrder === null ? 0 : (int) $sortOrder;
    }

    public function getDisplayScope(): int
    {
        return $this->displayScope;
    }

    public function setDisplayScope(null|int|string $displayScope): void
    {
        $this->displayScope = $displayScope === null || $displayScope === ''
            ? DisplayScope::All->value
            : DisplayScope::make((int) $displayScope)->value;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(null|int|string $status): void
    {
        $this->status = $status === null || $status === ''
            ? AppMenuStatus::Enabled->value
            : AppMenuStatus::make((int) $status)->value;
    }
}
