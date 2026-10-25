<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\File\Repository;

use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Repository\Model\TaskFileModel;
use App\Domain\SuperMagic\File\Repository\Persistence\TaskFileRepository;
use Hyperf\Context\ApplicationContext;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\Model\Register;
use Hyperf\DbConnection\Db;
use HyperfTest\Stub\Domain\SuperMagic\File\ArrayRowConnectionStub;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionMethod;

/**
 * 文件树 head / journal 的行形状回归测试。
 *
 * 线上 App\Listener\FetchModeListener 会把每个 statement 改成 PDO::FETCH_ASSOC，
 * 于是 Db::table()->first() 拿到的是关联数组。把行当对象读有两种后果，这里各钉住一类路径：
 *   - 写路径（appendFileTreeChanges）：抛 "Attempt to read property on array"，
 *     整个建话题/建文件事务回滚；
 *   - 回填与压缩路径：`?->` 读数组不报错，静默取到 revision=0 / oldest_revision=1。
 *
 * 用脚本化行结果的假连接覆盖这些路径，不依赖真实数据库。
 *
 * @internal
 */
class TaskFileRepositoryFileTreeRowShapeTest extends TestCase
{
    private const HEADS_TABLE = 'magic_fs_file_tree_heads';

    private const CHANGES_TABLE = 'magic_super_agent_task_file_tree_changes';

    private ?ContainerInterface $previousContainer = null;

    private ?ConnectionResolverInterface $previousModelResolver = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $this->previousModelResolver = Register::getConnectionResolver();
    }

    protected function tearDown(): void
    {
        (new ReflectionClass(ApplicationContext::class))->getProperty('container')->setValue(null, $this->previousContainer);
        if ($this->previousModelResolver === null) {
            Register::unsetConnectionResolver();
        } else {
            Register::setConnectionResolver($this->previousModelResolver);
        }

        parent::tearDown();
    }

    /**
     * 复现建话题时线上报错的分支：head 行不存在 -> insert ignore -> 重新锁定读到数组行。
     * 旧代码在这里读 $head->root_file_id，抛 "Attempt to read property ... on array"，
     * 被 catch 后整笔事务回滚（Error creating new topic）。
     */
    public function testAppendFileTreeChangesAllocatesRevisionFromArrayHeadRow(): void
    {
        $connection = (new ArrayRowConnectionStub())->queueSelectRows(
            [],                   // 首次锁 head：新文件树还没有 head 行
            [self::headRow(9001, 4)] // insert ignore 之后重新锁定
        );
        $this->useArrayRowDatabase($connection);

        $revisions = $this->appendFileTreeChanges([
            ['index' => 0, 'file' => self::rootDirectory(9001), 'operation' => 'create', 'old_parent_id' => null, 'old_name' => null],
        ]);

        self::assertSame([0 => 5], $revisions, '新 revision 必须从 head 的 4 递增到 5');

        $changeRows = $connection->lastWriteRowsFor(self::CHANGES_TABLE);
        self::assertCount(1, $changeRows, '变更必须落到 journal');
        self::assertSame(9001, $changeRows[0]['root_file_id']);
        self::assertSame(5, $changeRows[0]['revision'], 'journal 行必须带递增后的 revision');
    }

    /**
     * head 行存在时，读取路径不能再把行当对象：旧代码在 getFileTreeHeadRow() 的
     * `: object` 返回类型上直接抛 TypeError，列目录与 change-feed 接口都不可用。
     */
    public function testHeadReadsAndChangeFeedUseArrayRows(): void
    {
        $connection = (new ArrayRowConnectionStub())->queueSelectRows(
            [self::headRow(9001, 4)],
            [self::headRow(9001, 4)],
            [['change_id' => '11', 'root_file_id' => '9001', 'revision' => '3', 'file_id' => '5', 'name' => 'a.txt', 'operation' => 'create']]
        );
        $this->useArrayRowDatabase($connection);

        $repository = $this->repository();
        $root = self::rootDirectory(9001);

        self::assertSame(4, $repository->getFileTreeRevision($root));

        $feed = $repository->getFileTreeChangeFeed($root, 2, 10);
        self::assertSame(4, $feed['head']);
        self::assertSame(1, $feed['oldest']);
        self::assertFalse($feed['cursor_expired']);
        self::assertCount(1, $feed['rows']);
    }

    /**
     * 压缩任务扫描 head 后要按 root_file_id 续扫、并把批删的 oldest_revision
     * 推进到 journal 里真实的 MIN(revision)。旧代码把扫描行当对象读，
     * 整个压缩（含每小时 crontab）直接中断。
     */
    public function testCompactionSweepAndBatchDeleteUseArrayRows(): void
    {
        $connection = (new ArrayRowConnectionStub())->queueSelectRows(
            [self::headRow(9001, 4)],   // 扫描 heads
            [['revision' => '4']],      // compactFileTree: value('revision')
            [self::headRow(9001, 4)],   // 批删：锁定 head
            [['change_id' => '10']],    // 批删：pluck('change_id')
            [['aggregate' => '7']],     // 批删：min('revision') -> oldest_revision
            [self::headRow(9001, 4)]    // 第二轮批删：锁定 head
        );
        $this->useArrayRowDatabase($connection);

        $result = $this->repository()->compactFileTreeChangeJournal(2, 10, false);

        self::assertSame(1, $result['file_trees']);
        self::assertSame(1, $result['deleted_rows']);
        self::assertSame(1, $result['expired_file_trees']);

        $headRows = $connection->lastWriteRowsFor(self::HEADS_TABLE);
        self::assertSame(7, $headRows[0]['oldest_revision'], 'oldest_revision 必须推进到 journal 的 MIN(revision)=7');

        // 扫描游标必须推进到刚处理完的 head：读到 0 会让扫描永远停在第一棵树。
        $headScans = $connection->selectBindingsFor(self::HEADS_TABLE);
        self::assertSame([0], $headScans[0], '压缩扫描从 0 开始');
        self::assertSame([9001], $headScans[array_key_last($headScans)], '扫描游标必须推进到已处理的 root_file_id');
    }

    /**
     * 回填命令的静默路径：`$bounds?->revision ?? 0` 在数组行上不报错，只会取到 0，
     * 于是 head 被写成 revision=0 / oldest_revision=1，看起来成功、实际是错的。
     */
    public function testBackfilledHeadsUseJournalRevisionsInsteadOfDefaults(): void
    {
        $connection = (new ArrayRowConnectionStub())
            ->queueAffectedRows(2)
            ->queueSelectRows(
                [['file_id' => '7001'], ['file_id' => '7002']],                              // 扫描根目录（Eloquent pluck）
                [
                    ['root_file_id' => '7001', 'revision' => '9', 'oldest_revision' => '8'], // journal 聚合
                    ['root_file_id' => '7002', 'revision' => '3', 'oldest_revision' => '1'],
                ],
                []                                                                           // 下一批根目录：空，退出
            );
        $this->useArrayRowDatabase($connection);

        $summary = $this->repository()->initializeFileTreeHeads(1000);

        self::assertSame(2, $summary['discovered_file_trees']);
        self::assertSame(2, $summary['initialized_file_trees']);

        $bounds = static fn (array $row): array => [$row['root_file_id'], $row['revision'], $row['oldest_revision']];
        self::assertSame(
            [[7001, 9, 8], [7002, 3, 1]],
            array_map($bounds, $connection->lastWriteRowsFor(self::HEADS_TABLE)),
            'head 必须回填 journal 里真实的 MAX/MIN revision，而不是默认值'
        );
    }

    /**
     * Db 门面走容器里的 ConnectionResolverInterface，Eloquent 模型走
     * Hyperf\Database\Model\Register；两条路径都要指向假连接，测试才不会碰到真库。
     */
    private function useArrayRowDatabase(ArrayRowConnectionStub $connection): void
    {
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($connection);

        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(static function (string $id) use ($container, $resolver) {
            return match ($id) {
                Db::class => new Db($container),
                ConnectionResolverInterface::class => $resolver,
                default => null,
            };
        });

        ApplicationContext::setContainer($container);
        Register::setConnectionResolver($resolver);
    }

    private function repository(): TaskFileRepository
    {
        return new TaskFileRepository(new TaskFileModel());
    }

    /**
     * appendFileTreeChanges() 是私有方法：它是所有文件变更写入 journal 的收口，
     * 只能通过反射直接驱动，避免为了测试去构造整条 Eloquent 变更链路。
     *
     * @param array<int, array<string, mixed>> $events
     * @return array<int, int>
     */
    private function appendFileTreeChanges(array $events): array
    {
        return (new ReflectionMethod(TaskFileRepository::class, 'appendFileTreeChanges'))
            ->invoke($this->repository(), $events);
    }

    /**
     * @return array<string, mixed>
     */
    private static function headRow(int $rootFileId, int $revision): array
    {
        // 列值用字符串，与 PDO 取回的 bigint 一致。
        return [
            'root_file_id' => (string) $rootFileId,
            'revision' => (string) $revision,
            'oldest_revision' => '1',
            'updated_at' => '2026-09-20 14:08:59',
        ];
    }

    private static function rootDirectory(int $fileId): TaskFileEntity
    {
        return TaskFileEntity::fromRow([
            'file_id' => $fileId,
            'file_name' => 'topic_root',
            'is_directory' => 1,
            'parent_id' => null,
            'project_id' => 42,
            'topic_id' => 7,
            'space_type' => 'topic',
            'metadata_version' => 3,
        ]);
    }
}
