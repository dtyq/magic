<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Event\Subscribe;

use App\Application\SuperMagic\File\Service\MagicFSChangePublisher;
use Hyperf\Database\Events\ConnectionEvent;
use Hyperf\Database\Events\TransactionCommitted;
use Hyperf\Database\Events\TransactionRolledBack;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 事务收尾时把攒下的文件树变更推出去。
 *
 * Hyperf 没有 Db::afterCommit，但连接会 fire committed / rollingBack 事件
 * （Hyperf\Database\Concerns\ManagesTransactions::fireConnectionEvent），
 * 这就是本监听器挂的点。
 *
 * 顺序保证：只在最外层事务结束后 emit —— 此时 journal 行已经提交、对读者可见。
 * 反过来做（提交前 emit）客户端会"被唤醒、回拉却看不到任何变更"，
 * 而且因为不会再有下一次唤醒，它会一直停在旧游标上，比不推送更糟。
 */
class FileTreeChangeTransactionSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly MagicFSChangePublisher $changePublisher,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    public function listen(): array
    {
        return [
            TransactionCommitted::class,
            TransactionRolledBack::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof ConnectionEvent) {
            return;
        }

        try {
            if ($event instanceof TransactionRolledBack) {
                // 回滚掉的 revision 从未存在过。连同更早排队的桶一起丢掉是保守但安全的选择：
                // 推送是尽力而为，丢一条只会退化成一次轮询，而发出一个不存在的区间会让客户端白拉。
                $this->changePublisher->discard();
                return;
            }

            if ($event->connection->transactionLevel() > 0) {
                // 还有未提交的外层事务（savepoint）：journal 行对读者仍不可见，继续等。
                return;
            }

            $this->changePublisher->flush();
        } catch (Throwable $exception) {
            // 监听器跑在写入路径的收尾阶段，推送出错绝不能影响已经提交的写入。
            $this->logger->error('magicfs change feed flush failed', [
                'event' => $event::class,
                'connection' => $event->connectionName,
                'exception' => $exception->getMessage(),
            ]);
        }
    }
}
