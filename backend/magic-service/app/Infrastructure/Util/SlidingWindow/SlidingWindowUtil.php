<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\SlidingWindow;

use Hyperf\Coroutine\Coroutine;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 防抖工具类
 * 实现"执行最后一次请求"防抖策略.
 */
class SlidingWindowUtil
{
    protected LoggerInterface $logger;

    public function __construct(
        protected Redis $redis
    ) {
        $this->logger = di(LoggerFactory::class)->get(get_class($this));
    }

    /**
     * 防抖接口 - 执行最后一次请求策略
     * 在指定时间窗口内，只有最后一次请求会被执行.
     *
     * @param string $debounceKey 防抖键
     * @param float $delayVerificationSeconds 延迟验证时间（秒），也是实际的防抖窗口
     * @return bool 是否应该执行当前请求
     */
    public function shouldExecuteWithDebounce(
        string $debounceKey,
        float $delayVerificationSeconds = 0.5
    ): bool {
        $uniqueRequestId = uniqid('req_', true) . '_' . getmypid();
        // 键的过期时间应大于延迟验证时间，以作为安全保障
        $totalExpirationSeconds = (int) ceil($delayVerificationSeconds) + 1;
        $latestRequestRedisKey = $debounceKey . ':last_req';

        try {
            // 标记为最新请求
            $this->redis->set($latestRequestRedisKey, $uniqueRequestId, ['EX' => $totalExpirationSeconds]);

            // 等待验证时间
            Coroutine::sleep($delayVerificationSeconds);

            // 原子化地验证并声明执行权
            $script = <<<'LUA'
                if redis.call('get', KEYS[1]) == ARGV[1] then
                    return redis.call('del', KEYS[1])
                else
                    return 0
                end
LUA;
            $result = $this->redis->eval($script, [$latestRequestRedisKey, $uniqueRequestId], 1);
            return (int) $result === 1;
        } catch (Throwable $exception) {
            $this->logger->error('Debounce check failed: ' . $exception->getMessage(), [
                'debounce_key' => $debounceKey,
                'exception' => $exception,
            ]);
            // 出现异常时默认允许执行，避免关键业务被阻塞
            return true;
        }
    }
}
