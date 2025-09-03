<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO;

use App\Domain\Contact\Entity\ValueObject\DepartmentOption;
use App\Infrastructure\Core\AbstractDTO;

class DepartmentPathNodeDTO extends AbstractDTO
{
    protected string $departmentName;

    protected string $departmentId;

    protected string $parentDepartmentId;

    protected string $path;

    protected bool $visible;

    protected ?DepartmentOption $option = null;

    public function __construct(?array $data = null)
    {
        if (isset($data['option']) && is_numeric($data['option'])) {
            $data['option'] = DepartmentOption::tryFrom((int) $data['option']);
        }
        parent::__construct($data);
    }

    public function getOption(): ?DepartmentOption
    {
        return $this->option;
    }

    public function setOption(null|DepartmentOption|int|string $option): DepartmentPathNodeDTO
    {
        if (isset($option) && is_numeric($option)) {
            $this->option = DepartmentOption::tryFrom((int) $option);
        } else {
            $this->option = $option;
        }
        return $this;
    }

    public function getDepartmentName(): string
    {
        return $this->departmentName;
    }

    public function setDepartmentName(string $departmentName): DepartmentPathNodeDTO
    {
        $this->departmentName = $departmentName;
        return $this;
    }

    public function getDepartmentId(): string
    {
        return $this->departmentId;
    }

    public function setDepartmentId(string $departmentId): DepartmentPathNodeDTO
    {
        $this->departmentId = $departmentId;
        return $this;
    }

    public function getParentDepartmentId(): string
    {
        return $this->parentDepartmentId;
    }

    public function setParentDepartmentId(?string $parentDepartmentId): DepartmentPathNodeDTO
    {
        $this->parentDepartmentId = $parentDepartmentId ?? '';
        return $this;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function setPath(string $path): DepartmentPathNodeDTO
    {
        $this->path = $path;
        return $this;
    }

    public function isVisible(): bool
    {
        return $this->visible;
    }

    public function setVisible(bool $visible): DepartmentPathNodeDTO
    {
        $this->visible = $visible;
        return $this;
    }
}
