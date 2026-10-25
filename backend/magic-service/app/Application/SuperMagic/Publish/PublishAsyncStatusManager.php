<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Publish;

use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Throwable;

/** Agent/Skill 发布的短期 Redis 状态。 */
class PublishAsyncStatusManager
{
    private const PREFIX = 'super_magic:publish:';

    private LoggerInterface $logger;

    public function __construct(
        private readonly Redis $redis,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('PublishAsyncStatus');
    }

    public function initialize(string $taskId, array $data): void
    {
        $current = $this->get($taskId);
        if ($current !== null) {
            return;
        }
        $this->write($taskId, array_merge([
            'publish_task_id' => $taskId,
            'status' => 'processing',
            'progress' => 0,
            'file_key' => null,
            'error' => null,
            'created_at' => time(),
            'updated_at' => time(),
        ], $data));
    }

    public function update(string $taskId, array $changes): void
    {
        $data = array_merge($this->get($taskId) ?? [
            'publish_task_id' => $taskId,
            'created_at' => time(),
        ], $changes, ['updated_at' => time()]);
        $this->write($taskId, $data);
    }

    public function get(string $taskId): ?array
    {
        try {
            $raw = $this->redis->get(self::PREFIX . $taskId);
            if (! is_string($raw) || $raw === '') {
                return null;
            }
            $data = json_decode($raw, true);
            return is_array($data) ? $data : null;
        } catch (Throwable $e) {
            $this->logger->warning('读取异步发布状态失败', ['task_id' => $taskId, 'error' => $e->getMessage()]);
            return null;
        }
    }

    private function write(string $taskId, array $data): void
    {
        try {
            $this->redis->setex(
                self::PREFIX . $taskId,
                max(600, (int) config('super-magic.publish_async.ttl_seconds', 7200)),
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            );
        } catch (Throwable $e) {
            $this->logger->warning('写入异步发布状态失败', ['task_id' => $taskId, 'error' => $e->getMessage()]);
        }
    }
}
