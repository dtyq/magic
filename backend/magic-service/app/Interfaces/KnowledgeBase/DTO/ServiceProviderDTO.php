<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ServiceProviderDTO extends AbstractDTO
{
    public string $id;

    public string $name;

    /**
     * @var array<ServiceProviderModelDTO>
     */
    public array $models = [];

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): static
    {
        $this->id = $id;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;
        return $this;
    }

    public function getModels(): array
    {
        return $this->models;
    }

    public function setModels(array $models): static
    {
        $this->models = $models;
        return $this;
    }

    public function addModel(ServiceProviderModelDTO $model): static
    {
        $this->models[] = $model;
        return $this;
    }
}
