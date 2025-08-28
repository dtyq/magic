<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO;

use App\Infrastructure\Core\AbstractDTO;

class SuperMagicAgentListDTO extends AbstractDTO
{
    /**
     * Agent代码.
     */
    public string $id = '';

    /**
     * Agent名称.
     */
    public string $name = '';

    /**
     * Agent描述.
     */
    public string $description = '';

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name ?? '';
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description ?? '';
    }
}
