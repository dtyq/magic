<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Authorization\State;

use Hyperf\Contract\ConfigInterface;
use Hyperf\Redis\Redis;

/**
 * MCP Authorization state 的 Redis 一次性存储。
 */
class MCPAuthorizationStateStore
{
    public function __construct(
        private readonly Redis $redis,
        private readonly ConfigInterface $config
    ) {
    }

    /**
     * 写入授权 state。
     *
     * @param array<string, mixed> $data
     */
    public function put(string $state, array $data): void
    {
        $ttl = (int) $this->config->get('mcp_authorization.state_ttl', 600);
        $this->redis->set($this->key($state), serialize($data), ['EX' => $ttl]);
    }

    /**
     * 获取指定用户和 MCP Server 当前仍在进行中的授权 state。
     *
     * @return null|array<string, mixed>
     */
    public function getPending(string $organizationCode, string $userId, string $mcpServerCode): ?array
    {
        $state = $this->redis->get($this->pendingKey($organizationCode, $userId, $mcpServerCode));
        if (! is_string($state) || $state === '') {
            return null;
        }

        $stateData = $this->get($state);
        if ($stateData === null) {
            $this->clearPending($organizationCode, $userId, $mcpServerCode, $state);
            return null;
        }

        $stateData['state'] = $state;
        return $stateData;
    }

    /**
     * 尝试为指定用户和 MCP Server 建立唯一的进行中授权 state。
     */
    public function putPending(string $organizationCode, string $userId, string $mcpServerCode, string $state): bool
    {
        $ttl = (int) $this->config->get('mcp_authorization.state_ttl', 600);
        $result = $this->redis->set(
            $this->pendingKey($organizationCode, $userId, $mcpServerCode),
            $state,
            ['NX', 'EX' => $ttl]
        );
        return $result === true || $result === 'OK';
    }

    /**
     * 删除授权 state，主要用于并发竞争时清理未成为 pending 的候选 state。
     */
    public function delete(string $state): void
    {
        if ($state !== '') {
            $this->redis->del($this->key($state));
        }
    }

    /**
     * 使指定进行中的授权会话失效：删除 state 本体和 pending 索引。
     *
     * 用于 MCP 服务配置变化后丢弃过期授权链接。必须先失效再写入新 pending，
     * 否则 putPending 的 NX 语义会挡住新会话。
     */
    public function invalidatePending(string $organizationCode, string $userId, string $mcpServerCode, string $state): void
    {
        $this->delete($state);
        $this->clearPending($organizationCode, $userId, $mcpServerCode, $state);
    }

    /**
     * 仅当 pending 索引仍指向指定 state 时删除索引，避免误删并发产生的新会话。
     */
    public function clearPending(string $organizationCode, string $userId, string $mcpServerCode, string $state): void
    {
        if ($state === '') {
            return;
        }
        $this->redis->eval(
            'local value = redis.call("get", KEYS[1]); if value == ARGV[1] then redis.call("del", KEYS[1]); end; return value',
            [$this->pendingKey($organizationCode, $userId, $mcpServerCode), $state],
            1
        );
    }

    /**
     * 读取授权 state。
     *
     * @return null|array<string, mixed>
     */
    public function get(string $state): ?array
    {
        if ($state === '') {
            return null;
        }
        $value = $this->redis->get($this->key($state));
        if (! is_string($value) || $value === '') {
            return null;
        }
        $data = unserialize($value, ['allowed_classes' => false]);
        return is_array($data) ? $data : null;
    }

    /**
     * 使用 Lua 在 Redis 中原子读取并删除授权 state，防止回调重放。
     *
     * @return null|array<string, mixed>
     */
    public function consume(string $state): ?array
    {
        if ($state === '') {
            return null;
        }
        $value = $this->redis->eval(
            'local value = redis.call("get", KEYS[1]); if value then redis.call("del", KEYS[1]); end; return value',
            [$this->key($state)],
            1
        );
        if (! is_string($value) || $value === '') {
            return null;
        }
        $data = unserialize($value, ['allowed_classes' => false]);
        return is_array($data) ? $data : null;
    }

    private function key(string $state): string
    {
        return 'mcp_authorization_state:' . $state;
    }

    /**
     * 构造用户、组织和 MCP Server 维度的 pending 索引 key。
     */
    private function pendingKey(string $organizationCode, string $userId, string $mcpServerCode): string
    {
        $scopeHash = hash('sha256', implode("\0", [$organizationCode, $userId, $mcpServerCode]));
        return 'mcp_authorization_pending:' . $scopeHash;
    }
}
