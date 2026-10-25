<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils;

use RuntimeException;
use Throwable;

/**
 * 请求重试执行器，统一管理有限次数的失败重试.
 */
final class RetryExecutor
{
    private const MAX_RETRY_COUNT = 2;

    private const RETRY_DELAY_MICROSECONDS = 100000;

    /**
     * 执行请求，发生任意异常时最多重试两次并抛出最后一次异常.
     */
    public static function execute(callable $request): mixed
    {
        $lastException = null;

        for ($retryCount = 0; $retryCount <= self::MAX_RETRY_COUNT; ++$retryCount) {
            try {
                return $request();
            } catch (Throwable $exception) {
                $lastException = $exception;
            }

            if ($retryCount < self::MAX_RETRY_COUNT) {
                usleep(self::RETRY_DELAY_MICROSECONDS * ($retryCount + 1));
            }
        }

        throw $lastException ?? new RuntimeException('请求失败');
    }
}
