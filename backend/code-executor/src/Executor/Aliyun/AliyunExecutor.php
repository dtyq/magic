<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Executor\Aliyun;

use Dtyq\CodeExecutor\AbstractExecutor;
use Dtyq\CodeExecutor\Exception\ExecuteException;
use Dtyq\CodeExecutor\Exception\InvalidArgumentException;
use Dtyq\CodeExecutor\ExecutionRequest;
use Dtyq\CodeExecutor\ExecutionResult;
use Dtyq\CodeExecutor\Executor\Aliyun\Exception\CreateFunctionException;
use Dtyq\CodeExecutor\Executor\Aliyun\Exception\GetFunctionException;
use Dtyq\CodeExecutor\Executor\Aliyun\Exception\UpdateFunctionException;

class AliyunExecutor extends AbstractExecutor
{
    public function __construct(protected AliyunRuntimeClient $client) {}

    /**
     * @throws CreateFunctionException
     * @throws GetFunctionException
     * @throws InvalidArgumentException
     * @throws UpdateFunctionException
     */
    public function initialize(): void
    {
        $this->client->initialize();
    }

    public function getSupportedLanguages(): array
    {
        return $this->client->getSupportedLanguages();
    }

    /**
     * @throws ExecuteException
     * @throws InvalidArgumentException
     */
    protected function doExecute(ExecutionRequest $request): ExecutionResult
    {
        return $this->client->invoke($request);
    }
}
