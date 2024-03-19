<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor;

class ExecutionResult
{
    /**
     * @param string $output 执行输出
     * @param int $duration 执行耗时（毫秒）
     * @param array<string, mixed> $result 执行结果数据
     */
    public function __construct(
        private readonly string $output = '',
        private readonly int $duration = 0,
        private readonly array $result = []
    ) {}

    /**
     * 获取执行输出.
     */
    public function getOutput(): string
    {
        return $this->output;
    }

    /**
     * 获取执行耗时（毫秒）.
     */
    public function getDuration(): int
    {
        return $this->duration;
    }

    /**
     * 获取执行结果数据.
     *
     * @return array<string, mixed>
     */
    public function getResult(): array
    {
        return $this->result;
    }

    /**
     * 检查执行是否成功
     */
    public function isSuccessful(): bool
    {
        return $this->code === 0;
    }
}
