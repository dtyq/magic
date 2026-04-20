<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Health;

use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use Hyperf\Contract\ConfigInterface;

class HeartbeatStatusService
{
    public function __construct(
        private readonly ConfigInterface $config,
        private readonly RpcClientManager $rpcClientManager,
    ) {
    }

    /**
     * @return array{status:string,checks:array<string,mixed>,meta:array<string,mixed>,httpCode:int}
     */
    public function inspect(): array
    {
        $ipcConfig = (array) $this->config->get('ipc', []);
        $rpcClientEnabled = (bool) ($ipcConfig['rpc_client_enabled'] ?? false);
        $socketPath = (string) ($ipcConfig['socket_path'] ?? BASE_PATH . '/runtime/magic_engine.sock');
        $startupGraceSeconds = max(0, (int) ($ipcConfig['heartbeat_startup_grace_seconds'] ?? 45));

        if (! $rpcClientEnabled) {
            return [
                'status' => 'UP',
                'checks' => [
                    'php_up' => true,
                    'rpc_client_enabled' => false,
                    'go_alive' => true,
                ],
                'meta' => [
                    'mode' => 'ready',
                    'reason' => 'rpc_client_disabled',
                    'socket_path' => $this->toRelativePath($socketPath),
                ],
                'httpCode' => 200,
            ];
        }

        $snapshot = $this->rpcClientManager->getHealthSnapshot();
        $rpcConnected = (bool) ($snapshot['is_connected'] ?? false);
        $hasEverConnected = (bool) ($snapshot['has_ever_connected'] ?? false);
        $rpcLoopRunning = (bool) ($snapshot['running'] ?? false);
        $startedAtUnix = (int) ($snapshot['started_at_unix'] ?? 0);
        $startedSinceSeconds = $startedAtUnix > 0 ? max(0, time() - $startedAtUnix) : null;
        $withinStartupGrace = $rpcLoopRunning
            && ! $hasEverConnected
            && ($startedSinceSeconds === null || $startedSinceSeconds < $startupGraceSeconds);

        $status = 'UP';
        $httpCode = 200;
        $mode = 'ready';
        $reason = 'rpc_connected';

        // /heartbeat 只负责读取 RpcClientManager 的只读健康快照，必须保持无副作用：
        // - kube probe 可能高频触发，不能把探针变成进程编排器；
        // - Go 的拉起、重启、保活都应由入口脚本与容器运行时负责；
        // - 请求路径只读当前状态，绝不能在这里尝试修复 IPC、探测 UDS 或启动子进程。
        //
        // 状态语义：
        // - starting: 启动宽限期内，允许探针暂时通过，避免冷启动抖动重启；
        // - degraded: RPC 曾连通过，当前处于重连中，业务能力部分受限；
        // - down: 既未 ready，也不在可接受启动/重连状态内，返回 503 让探针感知失败。
        if ($rpcConnected) {
            $mode = 'ready';
            $reason = 'rpc_connected';
        } elseif ($withinStartupGrace) {
            $mode = 'starting';
            $reason = 'rpc_connecting_during_grace_period';
        } elseif ($rpcLoopRunning && $hasEverConnected) {
            $mode = 'degraded';
            $reason = 'rpc_reconnecting';
        } else {
            $status = 'DOWN';
            $httpCode = 503;
            $mode = 'down';
            $reason = 'rpc_not_ready';
        }

        $goAlive = $rpcConnected || $mode === 'degraded';

        return [
            'status' => $status,
            'checks' => [
                'php_up' => true,
                'rpc_client_enabled' => true,
                'rpc_connected' => $rpcConnected,
                'socket_connectable' => $rpcConnected,
                'go_alive' => $goAlive,
                'within_startup_grace' => $withinStartupGrace,
                'has_ever_connected' => $hasEverConnected,
            ],
            'meta' => [
                'mode' => $mode,
                'reason' => $reason,
                'startup_grace_seconds' => $startupGraceSeconds,
                'started_since_seconds' => $startedSinceSeconds,
                'socket_path' => $this->toRelativePath($socketPath),
                'rpc' => $snapshot,
            ],
            'httpCode' => $httpCode,
        ];
    }

    private function toRelativePath(string $path): string
    {
        if (defined('BASE_PATH') && str_starts_with($path, BASE_PATH)) {
            return ltrim(str_replace(BASE_PATH, '', $path), DIRECTORY_SEPARATOR);
        }
        return $path;
    }
}
