<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Repository\ValueObject;

use App\Domain\ModelAdmin\Entity\AbstractEntity;

class UpdateConsumerModel extends AbstractEntity
{
    protected string $name;

    protected string $icon;

    protected array $translate;

    protected array $visibleOrganizations;

    protected array $visibleApplications;

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function getTranslate(): array
    {
        return $this->translate;
    }

    public function setTranslate(array $translate): void
    {
        $this->translate = $translate;
    }

    public function getVisibleOrganizations(): array
    {
        return $this->visibleOrganizations;
    }

    public function setVisibleOrganizations(array $visibleOrganizations): void
    {
        $this->visibleOrganizations = $visibleOrganizations;
    }

    public function getVisibleApplications(): array
    {
        return $this->visibleApplications;
    }

    public function setVisibleApplications(array $visibleApplications): void
    {
        $this->visibleApplications = $visibleApplications;
    }
}
