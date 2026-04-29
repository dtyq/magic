<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

final readonly class GoEngineStartRequest
{
    public GoEngineProcessSpec $processSpec;

    public string $workDir;

    public string $command;

    public string $socketPath;

    public function __construct(GoEngineProcessSpec $processSpec)
    {
        $this->processSpec = $processSpec;
        $this->workDir = $this->processSpec->workDir;
        $this->command = $this->processSpec->displayCommand();
        $this->socketPath = $this->processSpec->socketPath;
    }

    public static function fromConfig(IpcBootstrapConfig $config): self
    {
        return new self($config->processSpec);
    }
}
