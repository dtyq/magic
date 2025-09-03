<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * SuperMagic 服务商简化 DTO.
 */
class SuperMagicProviderDTO extends AbstractDTO
{
    protected string $name = '';

    protected string $icon = '';

    protected int $sort = 0;

    protected bool $recommended = false;

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(null|int|string $name): void
    {
        if ($name === null) {
            $this->name = '';
        } else {
            $this->name = (string) $name;
        }
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(null|int|string $icon): void
    {
        if ($icon === null) {
            $this->icon = '';
        } else {
            $this->icon = (string) $icon;
        }
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(null|int|string $sort): void
    {
        if ($sort === null) {
            $this->sort = 0;
        } else {
            $this->sort = (int) $sort;
        }
    }

    public function isRecommended(): bool
    {
        return $this->recommended;
    }

    public function setRecommended(null|bool|int|string $recommended): void
    {
        if ($recommended === null) {
            $this->recommended = false;
        } elseif (is_string($recommended)) {
            $this->recommended = in_array(strtolower($recommended), ['true', '1', 'yes', 'on']);
        } else {
            $this->recommended = (bool) $recommended;
        }
    }
}
