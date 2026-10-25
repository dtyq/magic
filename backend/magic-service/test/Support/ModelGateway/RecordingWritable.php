<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Support\ModelGateway;

use Hyperf\Engine\Contract\Http\Writable;
use Swow\SocketException;
use Throwable;

/** 内存下游连接，仅记录合成帧并模拟指定输出阶段故障。 */
class RecordingWritable implements Writable
{
    public array $writes = [];

    public int $headerAttempts = 0;

    public int $writeAttempts = 0;

    public int $endAttempts = 0;

    public bool $failHeaders = false;

    public ?int $failWriteAt = null;

    public bool $failEnd = false;

    public ?Throwable $error = null;

    /** 返回不创建真实网络连接的响应头接收器。 */
    public function getSocket(): mixed
    {
        return new class($this) {
            /** 保存内存连接计数器。 */
            public function __construct(private RecordingWritable $owner)
            {
            }

            /** 兼容master基线通过write发送响应头的调用方式。 */
            public function write(array $data): void
            {
                $this->sendEventStreamHeaders([]);
            }

            /** 模拟Swow响应头写入成功或断连。 */
            public function sendEventStreamHeaders(array $headers): void
            {
                ++$this->owner->headerAttempts;
                if ($this->owner->failHeaders) {
                    throw new SocketException('mock header disconnect');
                }
            }
        };
    }

    /** 记录内容，指定帧返回false或抛出预设异常。 */
    public function write(string $data): bool
    {
        if (++$this->writeAttempts === $this->failWriteAt) {
            if ($this->error) {
                throw $this->error;
            }
            return false;
        }
        $this->writes[] = $data;
        return true;
    }

    /** 记录结束操作并模拟传输失败。 */
    public function end(): ?bool
    {
        ++$this->endAttempts;
        if ($this->failEnd && $this->error) {
            throw $this->error;
        }
        return ! $this->failEnd;
    }
}
