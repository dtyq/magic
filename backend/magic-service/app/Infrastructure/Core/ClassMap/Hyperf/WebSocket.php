<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\Engine\WebSocket;

use Hyperf\Engine\Contract\WebSocket\WebSocketInterface;
use Hyperf\HttpMessage\Exception\BadRequestHttpException;
use Swow\Http\Protocol\ProtocolException as HttpProtocolException;
use Swow\Http\Status;
use Swow\Psr7\Message\RequestPlusInterface;
use Swow\Psr7\Message\UpgradeType;
use Swow\Psr7\Psr7;
use Swow\Psr7\Server\ServerConnection;
use Swow\WebSocket\Opcode;

/**
 * 兼容 Swow alpha.3 的 WebSocket 适配器。
 *
 * 基于 hyperf/engine-swow 2.15.2，通过协议接口回复 PING，上游适配后应移除此覆盖。
 */
class WebSocket implements WebSocketInterface
{
    protected ?ServerConnection $connection;

    /**
     * @var array<string, callable>
     */
    protected array $events = [];

    /**
     * 验证升级请求并建立 WebSocket 连接。
     */
    public function __construct(ServerConnection $connection, RequestPlusInterface $request)
    {
        $upgradeType = Psr7::detectUpgradeType($request);

        if (($upgradeType & UpgradeType::UPGRADE_TYPE_WEBSOCKET) === 0) {
            $this->throwBadRequestException();
        }

        $this->connection = $connection;
        $this->connection->upgradeToWebSocket($request);
    }

    /**
     * 注册协议事件回调。
     */
    public function on(string $event, callable $callback): void
    {
        $this->events[$event] = $callback;
    }

    /**
     * 接收协议帧并通过协议接口回复心跳。
     */
    public function start(): void
    {
        try {
            while (true) {
                $frame = $this->connection->recvWebSocketFrame();
                $opcode = $frame->getOpcode();
                switch ($opcode) {
                    case Opcode::PING:
                        $this->connection->sendWebSocketPongFrame();
                        break;
                    case Opcode::PONG:
                        break;
                    case Opcode::CLOSE:
                        break 2;
                    default:
                        $callback = $this->events[static::ON_MESSAGE];
                        $callback($this->connection, $frame);
                }
            }
        } finally {
            try {
                $callback = $this->events[static::ON_CLOSE];
                // close 后系统 fd 可能为 -1；Socket ID 仍能定位握手时保存的连接映射。
                $callback($this->connection, $this->connection->getId());
            } finally {
                $this->connection = null;
                $this->events = [];
            }
        }
    }

    /**
     * 拒绝不支持的协议升级请求。
     */
    private function throwBadRequestException()
    {
        if (class_exists(BadRequestHttpException::class)) {
            throw new BadRequestHttpException('Unsupported Upgrade Type');
        }
        throw new HttpProtocolException(Status::BAD_REQUEST, 'Unsupported Upgrade Type');
    }
}
