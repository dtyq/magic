<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Tool;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionDataInterface;
use App\Infrastructure\Core\AbstractDTO;

final class ToolData extends AbstractDTO implements MentionDataInterface
{
    protected string $id;

    protected string $name;

    protected string $icon;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    /* Getters */
    public function getId(): ?string
    {
        return $this->id ?? null;
    }

    public function getName(): ?string
    {
        return $this->name ?? null;
    }

    public function getIcon(): ?string
    {
        return $this->icon ?? null;
    }

    /* Setters */
    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }
}
