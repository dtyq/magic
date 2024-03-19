<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\WebSocket;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\Config\WebSocketConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\WebSocket\Exception\WebSocketConnectionException;
use Hyperf\Codec\Json;
use Psr\Log\LoggerInterface;
use Swow\Psr7\Client\Client;
use Swow\Psr7\Psr7;
use Throwable;

class WebSocketClient
{
    // WebSocket帧类型常量
    private const OPCODE_PING = 9;

    private const OPCODE_PONG = 10;

    private const OPCODE_TEXT = 1;

    private const OPCODE_BINARY = 2;

    private ?Client $client = null;

    private int $lastPongTime;

    private bool $isConnected = false;

    private int $readTimeout;

    public function __construct(
        private readonly WebSocketConfig $config,
        private readonly LoggerInterface $logger,
        private readonly string $wsUrl,
        private readonly string $id,
        private readonly ?string $token = null
    ) {
        $this->lastPongTime = time();
        $this->readTimeout = $this->config->getReadTimeout();
    }

    /**
     * 建立WebSocket连接.
     *
     * @throws WebSocketConnectionException 连接失败时抛出
     */
    public function connect(): void
    {
        $urlParts = parse_url($this->wsUrl);
        if ($urlParts === false) {
            throw new WebSocketConnectionException('无效的WebSocket URL');
        }

        $host = $urlParts['host'] ?? '';
        $port = $urlParts['port'] ?? ($urlParts['scheme'] === 'wss' ? 443 : 80);
        $path = $urlParts['path'] ?? '/';
        $query = isset($urlParts['query']) ? '?' . $urlParts['query'] : '';

        if (empty($host)) {
            throw new WebSocketConnectionException('WebSocket URL缺少主机地址');
        }

        try {
            $this->client = new Client();
            $request = Psr7::createRequest('GET', $path . $query);

            // 添加token到HTTP请求头
            if ($this->token) {
                $request = $request->withHeader('token', $this->token);
            }

            $this->client->connect($host, $port);
            $this->client->upgradeToWebSocket($request);
            $this->isConnected = true;
            $this->lastPongTime = time();

            $this->logger->info(sprintf('已连接到WebSocket: %s', $this->wsUrl), [
                'id' => $this->id,
            ]);
        } catch (Throwable $e) {
            $this->isConnected = false;
            throw new WebSocketConnectionException(
                sprintf('WebSocket连接失败: %s', $e->getMessage()),
                0,
                $e
            );
        }
    }

    /**
     * 断开WebSocket连接.
     */
    public function disconnect(): void
    {
        /* @phpstan-ignore-next-line */
        if ($this->client !== null && method_exists($this->client, 'close')) {
            try {
                $this->client->close();
                $this->isConnected = false;
                $this->logger->info(sprintf('WebSocket连接已断开: %s', $this->wsUrl));
            } catch (Throwable $e) {
                $this->logger->warning(sprintf('关闭WebSocket连接失败: %s', $e->getMessage()));
            }
        }
    }

    /**
     * 检查WebSocket连接是否已建立.
     *
     * @return bool 连接状态
     */
    public function isConnected(): bool
    {
        return $this->isConnected;
    }

    /**
     * 发送WebSocket消息.
     *
     * @param array $data 要发送的消息数据
     * @throws WebSocketConnectionException 发送失败时抛出
     */
    public function send(array $data): void
    {
        if (! $this->isConnected()) {
            throw new WebSocketConnectionException('WebSocket未连接');
        }

        try {
            $jsonData = Json::encode($data);
            $message = Psr7::createWebSocketTextMaskedFrame($jsonData);
            $this->client?->sendWebSocketFrame($message);
        } catch (Throwable $e) {
            throw new WebSocketConnectionException(
                sprintf('发送消息失败: %s', $e->getMessage()),
                0,
                $e
            );
        }
    }

    /**
     * 接收WebSocket消息.
     *
     * @return null|array 接收到的消息数据或null（超时/无消息）
     * @throws WebSocketConnectionException 接收失败时抛出
     */
    public function receive(): ?array
    {
        if (! $this->isConnected()) {
            throw new WebSocketConnectionException('WebSocket未连接');
        }

        try {
            $frame = $this->client?->recvWebSocketFrame();
            if ($frame === null) {
                return null;
            }

            // 处理Pong帧
            if ($frame->getOpcode() === self::OPCODE_PONG) {
                $this->lastPongTime = time();
                $this->logger->debug(sprintf(
                    '收到Pong帧响应，ID: %s，时间: %s',
                    $this->id,
                    date('Y-m-d H:i:s')
                ));
                return null; // Pong帧不需要传递给上层应用
            }

            // 处理Ping帧 - 自动响应Pong
            if ($frame->getOpcode() === self::OPCODE_PING) {
                try {
                    $pongFrame = Psr7::createWebSocketFrame(
                        opcode: self::OPCODE_PONG,
                        payloadData: $frame->getPayloadData()->getContents(),
                        fin: true,
                        mask: true
                    );
                    $this->client?->sendWebSocketFrame($pongFrame);
                    $this->logger->debug(sprintf(
                        '收到Ping帧并自动响应Pong，ID: %s',
                        $this->id
                    ));
                } catch (Throwable $e) {
                    $this->logger->warning('响应Pong失败: ' . $e->getMessage());
                }
                return null; // Ping帧不需要传递给上层应用
            }

            // 处理文本消息
            if ($frame->getOpcode() === self::OPCODE_TEXT) {
                $messageText = (string) $frame->getPayloadData();
                return Json::decode($messageText);
            }

            // 处理二进制消息
            if ($frame->getOpcode() === self::OPCODE_BINARY) {
                $this->logger->debug(sprintf(
                    '收到二进制帧，长度: %d，ID: %s',
                    $frame->getPayloadLength(),
                    $this->id
                ));
                // 尝试将二进制数据解析为JSON
                try {
                    $messageText = (string) $frame->getPayloadData();
                    return Json::decode($messageText);
                } catch (Throwable $e) {
                    $this->logger->warning('无法解析二进制帧为JSON: ' . $e->getMessage());
                    return [
                        'type' => 'binary',
                        'data' => base64_encode((string) $frame->getPayloadData()),
                    ];
                }
            }

            $this->logger->debug(sprintf(
                '收到未知类型的帧，操作码: %d，ID: %s',
                $frame->getOpcode(),
                $this->id
            ));
            return null;
        } catch (Throwable $e) {
            throw new WebSocketConnectionException(
                sprintf('接收消息失败: %s', $e->getMessage()),
                0,
                $e
            );
        }
    }

    /**
     * 发送WebSocket协议级Ping帧.
     *
     * @return bool 发送是否成功
     */
    public function sendPing(): bool
    {
        if (! $this->isConnected()) {
            return false;
        }

        try {
            // 创建Ping帧
            $pingFrame = Psr7::createWebSocketFrame(
                opcode: self::OPCODE_PING,
                payloadData: $this->config->getHeartbeatMessage(),
                fin: true,
                mask: true
            );

            $this->client?->sendWebSocketFrame($pingFrame);
            $this->logger->debug(sprintf(
                '发送WebSocket Ping帧，ID: %s',
                $this->id
            ));

            return true;
        } catch (Throwable $e) {
            $this->logger->warning(sprintf(
                '发送Ping帧失败: %s，ID: %s',
                $e->getMessage(),
                $this->id
            ));
            return false;
        }
    }

    /**
     * 检查Pong响应是否超时.
     *
     * @return bool 如果超时返回true，否则返回false
     */
    public function isPongTimedOut(): bool
    {
        $pongTimeout = $this->config->getPongTimeout();
        return (time() - $this->lastPongTime) > $pongTimeout;
    }

    /**
     * 获取最后一次收到Pong帧的时间戳.
     */
    public function getLastPongTime(): int
    {
        return $this->lastPongTime;
    }

    /**
     * 设置读取超时时间.
     *
     * @param int $timeout 超时时间（秒）
     */
    public function setReadTimeout(int $timeout): void
    {
        $this->readTimeout = $timeout;
        $this->client?->setReadTimeout($timeout * 1000);
    }

    /**
     * 获取当前设置的读取超时时间.
     */
    public function getReadTimeout(): int
    {
        return $this->readTimeout;
    }
}
