<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Collector\ExecuteManager\Annotation;

use App\Infrastructure\Core\Contract\Flow\AgentPluginInterface;
use Attribute;
use Hyperf\Di\Annotation\AbstractAnnotation;

#[Attribute(Attribute::TARGET_CLASS)]
class AgentPluginDefine extends AbstractAnnotation
{
    private string $class;

    public function __construct(
        protected string $code,
        protected string $name,
        protected string $description = '',
        protected bool $enabled = true,
        protected int $priority = 0,
    ) {
    }

    public function collectClass(string $className): void
    {
        $this->class = $className;
        parent::collectClass($className);
    }

    public function getClass(): string
    {
        return $this->class;
    }

    public function createAgentPlugin(): AgentPluginInterface
    {
        return make($this->class);
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function getPriority(): int
    {
        return $this->priority;
    }
}
