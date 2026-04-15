<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Transport\Ipc\Uds;

use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Rpc\JsonRpc\ClientConfig;
use App\Infrastructure\Transport\Ipc\Contract\FramedTransportInterface;
use RuntimeException;
use Swow\Buffer;
use Swow\Socket;
use Throwable;

class UdsFramedTransport implements FramedTransportInterface
{
    use HasLogger;

    private const int SINGLE_PACKET_CUTOFF = 4096;

    private ?Socket $socket = null;

    private int $oversizeBurst = 0;

    private Buffer $headerBuffer;

    private ?Buffer $discardBuffer = null;

    private int $discardBufferSize = 0;

    public function __construct(
        private readonly string $socketPath,
        private readonly ClientConfig $config
    ) {
        $this->headerBuffer = new Buffer(4);
    }

    public function connect(): void
    {
        $this->socket = new Socket(Socket::TYPE_UNIX);
        $this->socket->connect($this->socketPath);
        $this->applySocketTimeouts();
    }

    public function close(): void
    {
        if ($this->socket) {
            try {
                $this->socket->close();
            } catch (Throwable) {
            }
            $this->socket = null;
        }
    }

    public function isConnected(): bool
    {
        return $this->socket !== null && $this->socket->isAvailable();
    }

    public function readFrame(): string
    {
        if (! $this->socket) {
            throw new RuntimeException('IPC socket not available');
        }

        while (true) {
            $readLength = $this->socket->recv($this->headerBuffer, 0, 4);
            if ($readLength !== 4) {
                throw new RuntimeException(sprintf('Read header failed, got %d bytes', $readLength));
            }

            $bodyLength = unpack('N', $this->headerBuffer->toString())[1];
            $this->headerBuffer->clear();

            if ($this->config->maxMessageBytes > 0 && $bodyLength > $this->config->maxMessageBytes) {
                if (! $this->handleOversizeFrame($bodyLength)) {
                    throw new RuntimeException('IPC oversize frame exceeds configured limit');
                }
                continue;
            }

            $body = $this->socket->readString($bodyLength);
            if ($bodyLength !== strlen($body)) {
                throw new RuntimeException('Read body failed, got ' . strlen($body) . ' bytes');
            }

            $this->oversizeBurst = 0;
            return $body;
        }
    }

    public function writeFrame(string $payload): void
    {
        $payloadLength = strlen($payload);
        if ($this->config->maxMessageBytes > 0 && $payloadLength > $this->config->maxMessageBytes) {
            throw new RuntimeException('IPC payload too large');
        }
        if (! $this->socket) {
            throw new RuntimeException('IPC socket not available');
        }

        $header = pack('N', $payloadLength);
        if ($payloadLength <= self::SINGLE_PACKET_CUTOFF) {
            $this->socket->send($header . $payload);
            return;
        }

        // 使用 writev 风格接口避免大包拼接；Swow 在失败时会抛异常。
        $this->socket->write([$header, $payload]);
    }

    public function getEndpointLabel(): string
    {
        if (defined('BASE_PATH') && str_starts_with($this->socketPath, BASE_PATH)) {
            return ltrim(str_replace(BASE_PATH, '', $this->socketPath), DIRECTORY_SEPARATOR);
        }
        return $this->socketPath;
    }

    private function applySocketTimeouts(): void
    {
        if ($this->socket) {
            $this->socket->setReadTimeout((int) ($this->config->readTimeout * 1000));
            $this->socket->setWriteTimeout((int) ($this->config->writeTimeout * 1000));
            $this->socket->setTimeout((int) ($this->config->readTimeout * 1000));
        }
    }

    private function applyReadTimeout(float $timeout): void
    {
        $this->socket?->setReadTimeout((int) ($timeout * 1000));
    }

    private function handleOversizeFrame(int $bodyLength): bool
    {
        $max = $this->config->maxMessageBytes;
        $multiplier = $this->config->discardCapMultiplier > 0 ? $this->config->discardCapMultiplier : 4;
        $discardCap = $max * $multiplier;

        if ($bodyLength > $discardCap) {
            $this->logger->error('IPC oversize frame exceeds discard cap', [
                'length' => $bodyLength,
                'max' => $max,
                'discard_cap' => $discardCap,
            ]);
            return false;
        }

        try {
            $this->discardBytes($bodyLength);
        } catch (Throwable $e) {
            $this->logger->error('IPC oversize frame discard failed', [
                'length' => $bodyLength,
                'max' => $max,
                'discard_cap' => $discardCap,
                'error' => $e->getMessage(),
            ]);
            return false;
        }

        $this->logger->warning('IPC oversize frame discarded, keep connection', [
            'length' => $bodyLength,
            'max' => $max,
            'discard_cap' => $discardCap,
        ]);

        ++$this->oversizeBurst;
        if ($this->config->oversizeMaxBurst > 0 && $this->oversizeBurst >= $this->config->oversizeMaxBurst) {
            $this->logger->warning('IPC oversize burst exceeded, closing connection', [
                'burst' => $this->oversizeBurst,
                'limit' => $this->config->oversizeMaxBurst,
            ]);
            return false;
        }

        return true;
    }

    private function discardBytes(int $length): void
    {
        if ($length <= 0 || ! $this->socket) {
            return;
        }

        $chunkSize = $this->config->discardChunkSize > 0 ? $this->config->discardChunkSize : 32768;
        $timeout = $this->config->discardTimeout > 0 ? $this->config->discardTimeout : $this->config->readTimeout;
        $remaining = $length;
        if ($this->discardBuffer === null || $this->discardBufferSize < $chunkSize) {
            $this->discardBuffer = new Buffer($chunkSize);
            $this->discardBufferSize = $chunkSize;
        }
        $buffer = $this->discardBuffer;

        $this->applyReadTimeout($timeout);
        while ($remaining > 0) {
            $readSize = min($remaining, $chunkSize);
            $readLength = $this->socket->recv($buffer, 0, $readSize);
            if ($readLength <= 0) {
                throw new RuntimeException(sprintf('Discard failed, got %d bytes', $readLength));
            }
            $remaining -= $readLength;
            $buffer->clear();
        }
        $this->applyReadTimeout($this->config->readTimeout);
    }
}
