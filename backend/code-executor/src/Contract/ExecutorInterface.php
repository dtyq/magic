<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Contract;

use Dtyq\CodeExecutor\ExecutionRequest;
use Dtyq\CodeExecutor\ExecutionResult;
use Dtyq\CodeExecutor\Language;

interface ExecutorInterface
{
    /**
     * 初始化执行器.
     */
    public function initialize(): void;

    /**
     * 执行代码
     *
     * @param ExecutionRequest $request 执行请求
     * @return ExecutionResult 执行结果
     */
    public function execute(ExecutionRequest $request): ExecutionResult;

    /**
     * 获取支持的语言列表.
     *
     * @return array<int, Language> 支持的语言列表
     */
    public function getSupportedLanguages(): array;
}
