<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig;

use App\Domain\Flow\Entity\ValueObject\Node;
use App\Infrastructure\Core\Contract\Flow\NodeParamsConfigInterface;

abstract class NodeParamsConfig implements NodeParamsConfigInterface
{
    protected string $validateScene = '';

    private bool $skipExecute = false;

    public function __construct(protected readonly Node $node)
    {
    }

    public function setSkipExecute(bool $skipExecute): void
    {
        $this->skipExecute = $skipExecute;
    }

    public function setValidateScene(string $scene): void
    {
        $this->validateScene = $scene;
    }

    /**
     * 获取节点配置模板.
     */
    public function generateTemplate(): void
    {
    }

    public function isSkipExecute(): bool
    {
        return $this->skipExecute;
    }

    public function getDefaultModelString(): string
    {
        return 'gpt-4o-global';
    }

    public function getDefaultVisionModelString(): string
    {
        return 'gpt-4o-global';
    }

    protected function isPublishValidate(): bool
    {
        return $this->validateScene === 'publish';
    }
}
