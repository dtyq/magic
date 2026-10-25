<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\File\Service;

use App\Application\SuperMagic\File\Service\MagicFSChangeFeedPendingChanges;
use App\Application\SuperMagic\File\Service\MagicFSChangePublisher;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * 推送器的关键行为：事务内只入队、提交后 flush、同 root 合并、超阈值退化、失败不外溢。
 *
 * 投递用测试子类顶替 SocketIO（不需要真的 socket.io 服务），事务层级也由测试子类给定
 * （不需要数据库）。合并窗口这里只断言"调度了延迟 flush"，因为真的 Timer 回调要协程调度器，
 * 普通 TestCase 里跑不起来；窗口到点之后的行为由 flush() 的用例覆盖。
 *
 * @internal
 */
class MagicFSChangePublisherTest extends TestCase
{
    private const ROOT = 7;

    private ?MagicFSChangePublisher $publisher = null;

    protected function tearDown(): void
    {
        // 待推送的桶挂在 Hyperf Context 上，非协程环境下是进程级主上下文，
        // 不主动丢弃会串到下一个用例。
        $this->publisher?->discard();
        parent::tearDown();
    }

    public function testQueueInsideTransactionDefersUntilFlush(): void
    {
        $publisher = $this->publisher(['level' => 1]);
        $publisher->queue(self::ROOT, 5, 6, [$this->row(6)]);

        self::assertSame([], $publisher->published, '事务未提交前不允许 emit');

        $publisher->level = 0;
        $publisher->flush();

        self::assertCount(1, $publisher->published);
        self::assertSame(5, $publisher->published[0]['from_revision']);
    }

    public function testQueueOutsideTransactionPublishesImmediately(): void
    {
        $publisher = $this->publisher(['window_ms' => 0]);
        $publisher->queue(self::ROOT, 5, 6, [$this->row(6)]);

        self::assertCount(1, $publisher->published, '不在事务里且窗口为 0 时应立即推送');
        self::assertSame([], $publisher->scheduled);
    }

    public function testCoalesceWindowSchedulesInsteadOfPublishing(): void
    {
        $publisher = $this->publisher(['window_ms' => 25]);
        $publisher->queue(self::ROOT, 5, 6, [$this->row(6)]);
        $publisher->queue(self::ROOT, 6, 7, [$this->row(7)]);

        self::assertSame([], $publisher->published, '窗口内的写入必须等窗口到点');
        self::assertCount(2, $publisher->scheduled, '每次写入都会续一个窗口定时器，它们共用同一个桶');

        // 模拟窗口到点：Timer 回调拿到的就是同一个桶，所以两次写入合成一次 emit。
        $publisher->flush();

        self::assertCount(1, $publisher->published);
        self::assertSame(5, $publisher->published[0]['from_revision']);
        self::assertSame(7, $publisher->published[0]['to_revision']);
        self::assertCount(2, $publisher->published[0]['changes']);
    }

    public function testCoalesceMergesAdjacentAppendsPerRoot(): void
    {
        $publisher = $this->publisher(['level' => 1, 'window_ms' => 0]);
        $publisher->queue(self::ROOT, 5, 6, [$this->row(6)]);
        $publisher->queue(self::ROOT, 6, 8, [$this->row(7), $this->row(8)]);
        $publisher->queue(9, 0, 1, [$this->row(1, '20', 'b.txt')]);
        $publisher->level = 0;
        $publisher->flush();

        self::assertCount(2, $publisher->published, '每个 root 一个 payload');

        $first = $publisher->published[0];
        self::assertSame((string) self::ROOT, $first['root_file_id']);
        self::assertSame(5, $first['from_revision'], 'from_revision 是排他下界，不是首行的 revision');
        self::assertSame(8, $first['to_revision']);
        self::assertFalse($first['truncated']);
        self::assertSame([6, 7, 8], array_column($first['changes'], 'revision'));

        $second = $publisher->published[1];
        self::assertSame('9', $second['root_file_id']);
        self::assertSame(0, $second['from_revision']);
        self::assertSame(1, $second['to_revision']);
    }

    public function testNonAdjacentRangesDegradeToTruncatedRange(): void
    {
        $publisher = $this->publisher(['level' => 1, 'window_ms' => 0]);
        $publisher->queue(self::ROOT, 5, 6, [$this->row(6)]);
        // 6 和 8 之间空了一格：内联行不再覆盖 (from, to]，只能让客户端回拉。
        $publisher->queue(self::ROOT, 7, 8, [$this->row(8)]);
        $publisher->level = 0;
        $publisher->flush();

        $payload = $publisher->published[0];
        self::assertTrue($payload['truncated']);
        self::assertSame([], $payload['changes']);
        self::assertSame(5, $payload['from_revision']);
        self::assertSame(8, $payload['to_revision']);
    }

    public function testInlineThresholdSendsTruncatedRange(): void
    {
        $publisher = $this->publisher(['level' => 1, 'window_ms' => 0, 'inline_max' => 2]);
        $publisher->queue(self::ROOT, 5, 8, [$this->row(6), $this->row(7), $this->row(8)]);
        $publisher->level = 0;
        $publisher->flush();

        $payload = $publisher->published[0];
        self::assertTrue($payload['truncated']);
        self::assertSame([], $payload['changes'], '超阈值只发区间，不发行');
        self::assertSame(5, $payload['from_revision']);
        self::assertSame(8, $payload['to_revision']);
    }

    public function testPayloadChangesReuseFileTreeChangeDtoShape(): void
    {
        $publisher = $this->publisher(['level' => 1, 'window_ms' => 0]);
        $publisher->queue(self::ROOT, 5, 6, [$this->row(6)]);
        $publisher->level = 0;
        $publisher->flush();

        $change = $publisher->published[0]['changes'][0];
        self::assertSame(
            ['revision', 'operation', 'file_id', 'parent_id', 'old_parent_id', 'name', 'old_name', 'file'],
            array_keys($change)
        );
        self::assertSame('10', $change['file_id']);
        self::assertSame('a.txt', $change['name']);
        // 空 file_metadata 必须仍是 JSON object，与 HTTP 拉取接口出参一致。
        self::assertSame('{}', json_encode($change['file']['file_metadata']));
        // payload 必须是纯数组：任何对象/闭包泄漏都会在这里炸。
        self::assertIsString(json_encode($publisher->published[0], JSON_THROW_ON_ERROR));
    }

    public function testRollbackDiscardsPendingChanges(): void
    {
        $publisher = $this->publisher(['level' => 1, 'window_ms' => 0]);
        $publisher->queue(self::ROOT, 5, 6, [$this->row(6)]);

        $publisher->discard();
        $publisher->level = 0;
        $publisher->flush();

        self::assertSame([], $publisher->published, '回滚掉的 revision 不该被推送');
    }

    public function testPublishFailureNeverPropagates(): void
    {
        $publisher = $this->publisher(['level' => 1, 'window_ms' => 0]);
        $publisher->failBroadcast = true;
        $publisher->queue(self::ROOT, 5, 6, [$this->row(6)]);
        $publisher->level = 0;

        $publisher->flush();

        self::assertSame([], $publisher->published);
    }

    public function testEmptyAndInvertedRangesAreIgnored(): void
    {
        $publisher = $this->publisher(['level' => 1, 'window_ms' => 0]);
        $publisher->queue(self::ROOT, 5, 5, []);
        $publisher->queue(0, 0, 3, [$this->row(1)]);
        $publisher->level = 0;
        $publisher->flush();

        self::assertSame([], $publisher->published);
    }

    public function testPendingBucketDropsRowsOnceThresholdIsExceeded(): void
    {
        // 纯逻辑用例：超阈值之后桶不再持有行，避免把上万行钉在内存里。
        $pending = new MagicFSChangeFeedPendingChanges(2);
        $pending->append(self::ROOT, 0, 3, [$this->row(1), $this->row(2), $this->row(3)]);
        $pending->append(self::ROOT, 3, 4, [$this->row(4)]);

        $payloads = $pending->drain();
        self::assertCount(1, $payloads);
        self::assertTrue($payloads[0]['truncated']);
        self::assertSame([], $payloads[0]['changes']);
        self::assertSame(4, $payloads[0]['to_revision']);
    }

    /**
     * @param array{level?:int,window_ms?:int,inline_max?:int} $options
     */
    private function publisher(array $options): RecordingChangePublisher
    {
        $values = [
            MagicFSChangePublisher::CONFIG_INLINE_MAX_CHANGES => $options['inline_max'] ?? 256,
            MagicFSChangePublisher::CONFIG_COALESCE_WINDOW_MS => $options['window_ms'] ?? 0,
        ];

        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(
            static fn (string $key, mixed $default = null): mixed => $values[$key] ?? $default
        );

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($this->createMock(LoggerInterface::class));

        $publisher = new RecordingChangePublisher($config, $loggerFactory, $options['level'] ?? 0);
        $this->publisher = $publisher;

        return $publisher;
    }

    /**
     * @return array<string, mixed>
     */
    private function row(int $revision, string $fileId = '10', string $name = 'a.txt'): array
    {
        return [
            'root_file_id' => self::ROOT,
            'revision' => $revision,
            'file_id' => $fileId,
            'parent_id' => '1',
            'old_parent_id' => null,
            'name' => $name,
            'old_name' => null,
            'operation' => 'create',
            'file_version' => 1,
            'file_snapshot' => json_encode([
                'id' => $fileId,
                'name' => $name,
                'parent_id' => '1',
                'is_directory' => false,
                'size' => 3,
                'mode' => 420,
                'file_metadata' => (object) [],
                's3_info' => ['object_key' => 'k/' . $fileId],
                'created_at' => null,
                'updated_at' => null,
                'version' => 1,
                'latest_version' => 1,
            ], JSON_THROW_ON_ERROR),
            'created_at' => '2025-01-01 00:00:00',
        ];
    }
}

/**
 * 测试替身：把"发出去了什么"和"事务进行到哪一层"记下来，供断言读取。
 *
 * 声明成具名类（而不是 new class）是为了让它出现在 publisher() 的返回类型里：
 * 公开的 $published / $scheduled 因此既是类型安全的，也是自我说明的。
 */
final class RecordingChangePublisher extends MagicFSChangePublisher
{
    /** @var array<int, array<string, mixed>> */
    public array $published = [];

    /** @var array<int, MagicFSChangeFeedPendingChanges> */
    public array $scheduled = [];

    public bool $failBroadcast = false;

    /**
     * 当前事务层级。公开且可写，因为用例需要在同一个替身上模拟
     * "事务内入队 → 提交 → flush" 的时序，而不是每个阶段换一个替身。
     */
    public int $level;

    public function __construct(ConfigInterface $config, LoggerFactory $loggerFactory, int $level = 0)
    {
        parent::__construct($config, $loggerFactory);
        $this->level = $level;
    }

    protected function transactionLevel(): int
    {
        return $this->level;
    }

    protected function broadcast(int $rootFileId, array $payload): void
    {
        if ($this->failBroadcast) {
            throw new RuntimeException('socket.io unavailable');
        }
        $this->published[] = $payload;
    }

    protected function scheduleDelayedFlush(MagicFSChangeFeedPendingChanges $pending): void
    {
        $this->scheduled[] = $pending;
    }
}
