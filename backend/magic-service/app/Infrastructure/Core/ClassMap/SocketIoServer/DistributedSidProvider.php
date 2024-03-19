<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\SocketIOServer\SidProvider;

use App\Infrastructure\Core\ClassMap\SocketIoServer\Contract\SidLifecycleProviderInterface;
use App\Infrastructure\Core\Traits\HasLogger;
use Hyperf\SocketIOServer\SocketIO;
use RuntimeException;

/**
 * 基于连接生命周期生成 sid，避免 fd 复用导致 sid 重复。
 *
 * sid 格式：{serverId}#{intSeq}
 */
class DistributedSidProvider implements SidProviderInterface, SidLifecycleProviderInterface
{
    use HasLogger;

    /**
     * connSeq 达到上限后的统一错误码，供 SocketIO 精确识别 overflow。
     */
    public const CONN_SEQ_OVERFLOW_CODE = 10001;

    /**
     * @var array<int, string> fd => sid
     */
    private array $fdToSid = [];

    /**
     * @var array<string, int> sid => fd
     */
    private array $sidToFd = [];

    /**
     * 当前连接序列，单调递增。
     */
    private int $nextConnSeq = 0;

    public function getSid(int $fd): string
    {
        if ($fd <= 0) {
            return '';
        }

        // 这里改成纯查询，不再“查询即创建 sid”。
        // sid 的创建只允许发生在 registerConnection()，避免在异常时序下生成幽灵 sid。
        return $this->fdToSid[$fd] ?? '';
    }

    public function isLocal(string $sid): bool
    {
        if ($sid === '') {
            return false;
        }

        $parts = explode('#', $sid, 2);
        if (count($parts) !== 2) {
            return false;
        }

        return $parts[0] === SocketIO::$serverId && isset($this->sidToFd[$sid]);
    }

    public function getFd(string $sid): int
    {
        return $this->sidToFd[$sid] ?? -1;
    }

    /**
     * 显式注册连接并分配新 sid。
     */
    public function registerConnection(int $fd): string
    {
        if ($fd <= 0) {
            return '';
        }

        if (isset($this->fdToSid[$fd])) {
            $this->unregisterConnection($fd);
        }

        $seq = $this->nextConnSeq();
        $sid = SocketIO::$serverId . '#' . $seq;

        $this->fdToSid[$fd] = $sid;
        $this->sidToFd[$sid] = $fd;

        return $sid;
    }

    /**
     * 连接关闭后移除 sid 映射。
     * 正常断连会走这里，进程异常退出场景则由 Redis TTL 链路最终兜底清理。
     */
    public function unregisterConnection(int $fd): void
    {
        if (! isset($this->fdToSid[$fd])) {
            return;
        }

        $sid = $this->fdToSid[$fd];
        unset($this->fdToSid[$fd], $this->sidToFd[$sid]);
    }

    /**
     * 获取下一个连接序列，达到 int 上限时抛异常兜底。
     */
    private function nextConnSeq(): int
    {
        if ($this->nextConnSeq >= PHP_INT_MAX) {
            $this->logger->error(sprintf('sidGuard event=connSeqOverflow serverId=%s', SocketIO::$serverId));
            throw new RuntimeException('conn seq overflow', self::CONN_SEQ_OVERFLOW_CODE);
        }

        ++$this->nextConnSeq;
        return $this->nextConnSeq;
    }
}
