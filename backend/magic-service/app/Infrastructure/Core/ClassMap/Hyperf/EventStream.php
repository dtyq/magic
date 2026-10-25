<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\Engine\Http;

use Hyperf\Engine\Contract\Http\Writable;
use Psr\Http\Message\ResponseInterface;
use Swow\Psr7\Server\ServerConnection;

/**
 * 兼容 Swow alpha.3 的 SSE 响应适配器。
 *
 * 基于 hyperf/engine-swow 2.15.2，通过协议接口发送响应头，上游适配后应移除此覆盖。
 */
class EventStream
{
    /**
     * 合并响应头并发送 SSE 流式响应头。
     */
    public function __construct(protected Writable $connection, ?ResponseInterface $response = null)
    {
        $headers = [
            'Content-Type' => 'text/event-stream; charset=utf-8',
            'Transfer-Encoding' => 'chunked',
            'Cache-Control' => 'no-cache',
        ];
        foreach ($response?->getHeaders() ?? [] as $name => $values) {
            // 分块响应由协议接口处理长度及传输编码，避免继承固定响应长度。
            if (in_array(strtolower($name), ['content-length', 'transfer-encoding'], true)) {
                continue;
            }
            $headers[$name] = implode(', ', $values);
        }

        /** @var ServerConnection $serverConnection */
        $serverConnection = $this->connection->getSocket();
        $serverConnection->sendEventStreamHeaders($headers);
    }

    /**
     * 发送一个流式数据块。
     */
    public function write(string $data): self
    {
        $this->connection->write($data);
        return $this;
    }

    /**
     * 发送流式响应的结束标记。
     */
    public function end(): void
    {
        $this->connection->end();
    }
}
