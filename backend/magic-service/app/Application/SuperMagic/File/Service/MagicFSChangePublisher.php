<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Service;

use App\Domain\SuperMagic\File\Contract\FileTreeChangePublisherInterface;
use App\Interfaces\SuperMagic\File\MagicFS\Facade\MagicFSChangeFeedApi;
use Hyperf\Context\Context;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Coordinator\Timer;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Coroutine\defer;

/**
 * 事务感知的文件树变更推送器。
 *
 * 发布点是 TaskFileRepository::appendFileTreeChanges()：它是所有 journal 写入的唯一咽喉。
 * 但 journal 行在事务提交前对读者不可见，此时推送出去会变成"客户端被唤醒、回拉却看不到任何变更"，
 * 于是事务内的变更先攒进协程上下文，等提交后再由监听器统一 flush。
 *
 * 推送只是加速器，journal 才是唯一真相：任何推送失败都只记日志，
 * 绝不回灌到调用方的写入路径，最坏情况只是退回一个轮询周期。
 */
class MagicFSChangePublisher implements FileTreeChangePublisherInterface
{
    /** inline_max_changes 的配置键（push 与 pull 共用的阈值）。 */
    public const string CONFIG_INLINE_MAX_CHANGES = 'magicfs.change_feed.inline_max_changes';

    /** coalesce_window_ms 的配置键。 */
    public const string CONFIG_COALESCE_WINDOW_MS = 'magicfs.change_feed.coalesce_window_ms';

    /** 协程上下文：待推送的变更桶。放在上下文里，并发请求之间不会互相串。 */
    private const string PENDING_CONTEXT_KEY = 'magicfs.change_feed.pending';

    /** 协程上下文：defer 兜底 flush 只注册一次。 */
    private const string DEFER_CONTEXT_KEY = 'magicfs.change_feed.defer_registered';

    private LoggerInterface $logger;

    private int $inlineMaxChanges;

    private float $coalesceWindowSeconds;

    private ?Timer $timer = null;

    public function __construct(ConfigInterface $config, LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get(static::class);
        $this->inlineMaxChanges = max(1, (int) $config->get(self::CONFIG_INLINE_MAX_CHANGES, 256));
        $this->coalesceWindowSeconds = max(0, (int) $config->get(self::CONFIG_COALESCE_WINDOW_MS, 25)) / 1000;
    }

    /**
     * 服务端合并窗口，单位毫秒。订阅握手时回给客户端，让两侧对"一次推送的粒度"有同一个预期。
     */
    public function coalesceIntervalMs(): int
    {
        return (int) round($this->coalesceWindowSeconds * 1000);
    }

    public function queue(int $rootFileId, int $fromRevision, int $toRevision, array $rows): void
    {
        if ($rootFileId <= 0 || $toRevision <= $fromRevision || $rows === []) {
            return;
        }

        $pending = $this->pending();
        $pending->append($rootFileId, $fromRevision, $toRevision, $rows);

        // 兜底：请求协程结束前如果还有没发出去的桶，也要发一次。
        // 事务内的提交由 TransactionCommitted 监听器负责，这条只是防漏。
        $this->registerDeferredFlush();

        if ($this->transactionLevel() > 0) {
            return;
        }

        $this->schedule($pending);
    }

    /**
     * 发出当前协程攒下的全部变更。
     */
    public function flush(): void
    {
        $pending = Context::get(self::PENDING_CONTEXT_KEY);
        if (! $pending instanceof MagicFSChangeFeedPendingChanges) {
            return;
        }

        // 排序屏障：只要事务还没结束，读者就看不到这些 revision。
        // 抢在提交前 emit，客户端回拉只会看到空页，然后（因为没有新唤醒）永远停在旧游标。
        if ($this->transactionLevel() > 0) {
            return;
        }

        Context::destroy(self::PENDING_CONTEXT_KEY);
        $this->publish($pending);
    }

    /**
     * 丢弃当前协程攒下的变更。
     *
     * 事务回滚时这些 revision 从未存在过，发出去只会让客户端白拉一次。
     */
    public function discard(): void
    {
        Context::destroy(self::PENDING_CONTEXT_KEY);
    }

    /**
     * 推送出口。测试可以覆盖它来断言投递，不必起真的 Socket.IO 服务。
     */
    protected function broadcast(int $rootFileId, array $payload): void
    {
        MagicFSChangeFeedApi::publish($rootFileId, $payload);
    }

    /**
     * 测试接缝：事务判定不应该把单测绑到数据库上。
     */
    protected function transactionLevel(): int
    {
        return Db::transactionLevel();
    }

    /**
     * 合并窗口接缝。
     *
     * Timer 回调在**另一个协程**里执行，而 Hyperf 的协程上下文不继承
     * （Hyperf\Engine\Coroutine 给每个协程一个全新的 ArrayObject），
     * 所以这里按对象引用把桶带过去，而不是让回调再去 Context 里取。
     * 效果是一串单文件写入在窗口内合成一次 emit。
     */
    protected function scheduleDelayedFlush(MagicFSChangeFeedPendingChanges $pending): void
    {
        $this->timer()->after($this->coalesceWindowSeconds, function () use ($pending): void {
            $this->publish($pending);
        });
    }

    private function pending(): MagicFSChangeFeedPendingChanges
    {
        $pending = Context::get(self::PENDING_CONTEXT_KEY);
        if (! $pending instanceof MagicFSChangeFeedPendingChanges) {
            $pending = new MagicFSChangeFeedPendingChanges($this->inlineMaxChanges);
            Context::set(self::PENDING_CONTEXT_KEY, $pending);
        }

        return $pending;
    }

    private function schedule(MagicFSChangeFeedPendingChanges $pending): void
    {
        if ($this->coalesceWindowSeconds <= 0) {
            $this->publish($pending);
            return;
        }

        $this->scheduleDelayedFlush($pending);
    }

    private function publish(MagicFSChangeFeedPendingChanges $pending): void
    {
        // 没有订阅者的 root 也照发：查一次 room 成员要多一次 Redis 往返，
        // 不值得塞进写入路径；适配器自己会在没有任何目标节点时直接返回。
        foreach ($pending->drain() as $payload) {
            try {
                $this->broadcast((int) $payload['root_file_id'], $payload);
            } catch (Throwable $exception) {
                $this->logger->error('magicfs change feed push failed', [
                    'root_file_id' => $payload['root_file_id'],
                    'from_revision' => $payload['from_revision'],
                    'to_revision' => $payload['to_revision'],
                    'truncated' => $payload['truncated'],
                    'exception' => $exception->getMessage(),
                ]);
            }
        }
    }

    private function registerDeferredFlush(): void
    {
        if (Context::get(self::DEFER_CONTEXT_KEY) === true) {
            return;
        }
        Context::set(self::DEFER_CONTEXT_KEY, true);

        // 非协程环境（部分命令/脚本）里 defer 是静默 no-op，正好不需要兜底。
        defer(function (): void {
            $this->flush();
        });
    }

    private function timer(): Timer
    {
        // 懒创建：窗口为 0 时不该碰容器，单测也就不需要协程调度器。
        return $this->timer ??= di(Timer::class);
    }
}
