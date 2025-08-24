<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request;

/**
 * Checkpoint回滚提交请求类
 * 严格按照沙箱通信文档的checkpoint回滚提交请求格式.
 */
class CheckpointRollbackCommitRequest
{
    /**
     * 创建一个checkpoint回滚提交请求对象
     */
    public static function create(): self
    {
        return new self();
    }

    /**
     * 转换为API请求数组
     * 根据沙箱通信文档的checkpoint回滚提交请求格式（空请求体）.
     */
    public function toArray(): array
    {
        return [];
    }
}
