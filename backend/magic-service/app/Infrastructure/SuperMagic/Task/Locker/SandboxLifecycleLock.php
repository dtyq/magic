<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\Task\Locker;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Locker\RedisLocker;
use Hyperf\Context\Context;
use Hyperf\Engine\Channel;
use Hyperf\Engine\Coroutine;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class SandboxLifecycleLock
{
    protected const RENEW_INTERVAL_SECONDS = 20;

    private const LEASE_SECONDS = 600;

    private const WAIT_SECONDS = 600;

    private LoggerInterface $logger;

    public function __construct(private readonly RedisLocker $locker, LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get('sandbox');
    }

    /**
     * Serialize all sandbox lifecycle mutations for the canonical topic ID.
     * The callback checks ownership before each irreversible stage.
     *
     * @template T
     * @param callable(callable(): void): T $operation
     * @return T
     */
    public function run(int $topicId, callable $operation, ?int $waitSeconds = null): mixed
    {
        $name = 'super_agent:sandbox:init:' . $topicId;
        // Include the coroutine ID: child coroutines may inherit Context values.
        $contextKey = $name . ':' . \Hyperf\Coroutine\Coroutine::id();
        $nested = Context::get($contextKey);
        if (is_callable($nested)) {
            $nested();
            return $operation($nested);
        }
        $owner = bin2hex(random_bytes(16));
        if (! $this->locker->spinLock($name, $owner, self::LEASE_SECONDS, $waitSeconds ?? self::WAIT_SECONDS)) {
            throw new BusinessException('Sandbox lifecycle is still running for topic ID: ' . $topicId);
        }

        $stop = null;
        $done = null;
        $leaseLost = false;
        $operationFailed = false;
        $renewalStarted = false;
        try {
            $stop = new Channel(1);
            $done = new Channel(1);
            Coroutine::create(function () use ($stop, $done, $name, $owner, &$leaseLost): void {
                try {
                    while (true) {
                        $stop->pop(static::RENEW_INTERVAL_SECONDS);
                        if (! $stop->isTimeout()) {
                            break;
                        }
                        if (! $this->locker->renew($name, $owner, self::LEASE_SECONDS)) {
                            $leaseLost = true;
                            break;
                        }
                    }
                } catch (Throwable $exception) {
                    $leaseLost = true;
                    $this->logger->error('沙箱生命周期锁续期失败', ['topic_lock' => $name, 'exception' => $exception->getMessage()]);
                } finally {
                    $done->push(true);
                }
            });

            $renewalStarted = true;

            $assertOwnership = function () use ($name, $owner, $topicId, &$leaseLost): void {
                if ($leaseLost || ! $this->locker->renew($name, $owner, self::LEASE_SECONDS)) {
                    $leaseLost = true;
                    throw new BusinessException('Sandbox lifecycle lock lost for topic ID: ' . $topicId);
                }
            };
            $assertOwnership();
            Context::set($contextKey, $assertOwnership);
            return $operation($assertOwnership);
        } catch (Throwable $exception) {
            $operationFailed = true;
            throw $exception;
        } finally {
            Context::destroy($contextKey);
            // Join renewal before releasing, so no background renewal outlives the operation.
            if ($stop !== null) {
                $stop->close();
            }
            if ($done !== null && $renewalStarted) {
                $done->pop();
                $done->close();
            }
            try {
                if (! $this->locker->release($name, $owner) && ! $operationFailed) {
                    $this->logger->warning('沙箱生命周期结束时锁已失效', ['topic_id' => $topicId]);
                }
            } catch (Throwable $exception) {
                // Do not replace a completed result or the original operation failure.
                $this->logger->error('沙箱生命周期锁释放失败', ['topic_id' => $topicId, 'exception' => $exception->getMessage()]);
            }
        }
    }
}
