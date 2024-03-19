<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Collector\ExecuteManager\Annotation;

use Attribute;
use Hyperf\Di\Annotation\AbstractAnnotation;

#[Attribute(Attribute::TARGET_CLASS)]
class FlowNodeDefine extends AbstractAnnotation
{
    protected string $runner = '';

    public function __construct(
        protected int $type,
        protected string $code,
        protected string $name,
        protected string $paramsConfig,
        protected string $description = '',
        protected string $version = 'latest',
        protected bool $singleDebug = false,
        protected bool $needInput = false,
        protected bool $needOutput = false,
        protected bool $enabled = true,
    ) {
    }

    public function getRunner(): string
    {
        return $this->runner;
    }

    public function setRunner(string $runner): void
    {
        $this->runner = $runner;
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getParamsConfig(): string
    {
        return $this->paramsConfig;
    }

    public function getVersion(): string
    {
        return $this->version;
    }

    public function isSingleDebug(): bool
    {
        return $this->singleDebug;
    }

    public function isNeedInput(): bool
    {
        return $this->needInput;
    }

    public function isNeedOutput(): bool
    {
        return $this->needOutput;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }
}
