<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Flow;

use App\Domain\Flow\Entity\MagicFlowToolSetEntity;

interface BuiltInToolSetInterface
{
    /**
     * @return array<string, BuiltInToolInterface>
     */
    public function getTools(): array;

    /**
     * @param array<string, BuiltInToolInterface> $tools
     */
    public function setTools(array $tools): void;

    public function addTool(BuiltInToolInterface $tool): void;

    public function generateToolSet(): MagicFlowToolSetEntity;

    public function getCode(): string;

    public function getName(): string;

    public function getDescription(): string;

    public function getIcon(): string;

    public function isShow(): bool;
}
