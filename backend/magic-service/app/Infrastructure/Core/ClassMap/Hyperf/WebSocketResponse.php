<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\Engine\WebSocket;

use Hyperf\Engine\Contract\WebSocket\FrameInterface;
use Hyperf\Engine\Contract\WebSocket\ResponseInterface;
use Swow\Psr7\Message\WebSocketFrame;
use Swow\Psr7\Server\ServerConnection;

/** 使用稳定连接身份适配 Hyperf 的 WebSocket 响应接口。 */
class Response implements ResponseInterface
{
    /** 保存当前连接以处理发送和关闭操作。 */
    public function __construct(protected ServerConnection $connection)
    {
    }

    /** 将协议帧发送到当前连接。 */
    public function push(FrameInterface $frame): bool
    {
        if (! $frame instanceof WebSocketFrame) {
            // 仅转换非 Swow 原生帧，保留协议头并复用原有载荷流。
            $frame = new WebSocketFrame(
                $frame->getFin(),
                $frame->getRSV1(),
                $frame->getRSV2(),
                $frame->getRSV3(),
                $frame->getOpcode(),
                $frame->getPayloadLength(),
                $frame->getMaskingKey(),
                $frame->getPayloadData()
            );
        }
        $this->connection->sendWebSocketFrame($frame);
        return true;
    }

    /** 兼容响应初始化接口，连接已由构造函数指定。 */
    public function init(mixed $frame): static
    {
        return $this;
    }

    /** 返回与握手及关闭回调一致的连接身份。 */
    public function getFd(): int
    {
        // 保留 Hyperf 接口名称，返回值必须与 FdGetter、关闭回调使用相同的 Socket ID。
        return $this->connection->getId();
    }

    /** 关闭底层连接并返回关闭结果。 */
    public function close(): bool
    {
        return $this->connection->close();
    }
}
