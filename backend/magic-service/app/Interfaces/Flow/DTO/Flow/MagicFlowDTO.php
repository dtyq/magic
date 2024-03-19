<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO\Flow;

use App\Interfaces\Flow\Assembler\Node\MagicFlowNodeAssembler;
use App\Interfaces\Flow\DTO\AbstractFlowDTO;
use App\Interfaces\Flow\DTO\Node\NodeDTO;
use Dtyq\FlowExprEngine\Component;

class MagicFlowDTO extends AbstractFlowDTO
{
    /**
     * 流程名称（助理名称）.
     */
    public string $name = '';

    /**
     * 流程描述 （助理描述）.
     */
    public string $description = '';

    /**
     * 流程图标（助理头像）.
     */
    public string $icon = '';

    public int $type = 0;

    public string $toolSetId = '';

    public array $edges = [];

    /**
     * @var NodeDTO[]
     */
    public array $nodes = [];

    public ?Component $globalVariable = null;

    public bool $enabled = false;

    public string $versionCode = '';

    public int $userOperation = 0;

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

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): void
    {
        $this->icon = $icon ?? '';
    }

    public function getToolSetId(): string
    {
        return $this->toolSetId;
    }

    public function setToolSetId(?string $toolSetId): void
    {
        $this->toolSetId = $toolSetId ?? '';
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(?int $type): void
    {
        $this->type = $type ?? 0;
    }

    public function getEdges(): array
    {
        return $this->edges;
    }

    public function setEdges(?array $edges): void
    {
        $this->edges = $edges ?? [];
    }

    /**
     * @return NodeDTO[]
     */
    public function getNodes(): array
    {
        return $this->nodes;
    }

    public function setNodes(?array $nodes): void
    {
        if ($nodes === null) {
            $this->nodes = [];
            return;
        }

        $list = [];
        foreach ($nodes as $node) {
            $nodeDTO = MagicFlowNodeAssembler::createNodeDTOByMixed($node);
            if ($nodeDTO) {
                $list[] = $nodeDTO;
            }
        }
        $this->nodes = $list;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled ?? false;
    }

    public function getVersionCode(): string
    {
        return $this->versionCode;
    }

    public function setVersionCode(?string $versionCode): void
    {
        $this->versionCode = $versionCode ?? '';
    }

    public function getGlobalVariable(): ?Component
    {
        return $this->globalVariable;
    }

    public function setGlobalVariable(mixed $globalVariable): void
    {
        $this->globalVariable = $this->createComponent($globalVariable);
    }

    public function getUserOperation(): int
    {
        return $this->userOperation;
    }

    public function setUserOperation(?int $userOperation): void
    {
        $this->userOperation = $userOperation ?? 0;
    }
}
