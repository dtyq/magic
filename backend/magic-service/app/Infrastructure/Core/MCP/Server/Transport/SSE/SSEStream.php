<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Transport\SSE;

use Hyperf\Engine\Http\WritableConnection;
use Psr\Http\Message\ResponseInterface;

/**
 * 使用 Swow 协议接口发送 MCP SSE 分块响应。
 */
class SSEStream extends WritableConnection
{
    /**
     * 发送 SSE 响应头并标记响应已发送。
     */
    public function __construct(?ResponseInterface $response = null)
    {
        /* @phpstan-ignore-next-line */
        parent::__construct($response->getConnection()->getSocket());

        $headers = [
            'Content-Type' => 'text/event-stream; charset=utf-8',
            'Transfer-Encoding' => 'chunked',
            'Connection' => 'keep-alive',
            'Cache-Control' => 'no-cache',
        ];
        foreach ($response->getHeaders() ?? [] as $name => $values) {
            // 分块响应由协议接口处理长度及传输编码，避免继承固定响应长度。
            if (in_array(strtolower($name), ['content-length', 'transfer-encoding'], true)) {
                continue;
            }
            $headers[$name] = implode(', ', $values);
        }

        $this->response->sendEventStreamHeaders($headers);
        $this->sent = true;
    }

    /**
     * 保留原有 SSE 行结束符，并使用 HTTP 分块接口发送数据。
     */
    public function write(string $data): bool
    {
        return parent::write($data . "\r\n");
    }
}
