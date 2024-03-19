<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Flow;

use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use Closure;

interface BuiltInToolInterface
{
    public function generateToolFlow(string $organizationCode = '', string $userId = ''): MagicFlowEntity;

    public function getToolSetCode(): string;

    public function getCode(): string;

    public function getName(): string;

    public function getDescription(): string;

    public function getInput(): ?NodeInput;

    public function getOutPut(): ?NodeOutput;

    public function getCustomSystemInput(): ?NodeInput;

    public function getCallback(): ?Closure;

    public function getAppendSystemPrompt(array $customParams = []): string;

    public function isShow(): bool;
}
