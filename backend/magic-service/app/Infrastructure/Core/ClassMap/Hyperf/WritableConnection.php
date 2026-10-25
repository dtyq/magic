<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\Engine\Http;

use Hyperf\Engine\Contract\Http\Writable;
use Swow\Psr7\Server\ServerConnection;

/**
 * 兼容 Swow alpha.3 的 HTTP 分块写入适配器。
 *
 * 基于 hyperf/engine-swow 2.15.2，使用协议接口发送分块，上游适配后应移除此覆盖。
 */
class WritableConnection implements Writable
{
    protected bool $sent = false;

    /**
     * 保存协议连接对象。
     */
    public function __construct(protected ServerConnection $response)
    {
    }

    /**
     * 通过协议接口发送数据块，发送成功后标记响应已发送。
     */
    public function write(string $data): bool
    {
        $this->response->sendHttpChunk($data);

        $this->sent = true;

        return true;
    }

    /**
     * 获取协议连接对象，保持既有接口语义。
     *
     * @return ServerConnection
     */
    public function getSocket(): mixed
    {
        return $this->response;
    }

    /**
     * 发送最后一个分块并标记响应已发送。
     */
    public function end(): ?bool
    {
        $this->response->sendHttpLastChunk();

        $this->sent = true;

        return true;
    }

    /**
     * 获取响应发送状态。
     */
    public function isSent(): bool
    {
        return $this->sent;
    }
}
