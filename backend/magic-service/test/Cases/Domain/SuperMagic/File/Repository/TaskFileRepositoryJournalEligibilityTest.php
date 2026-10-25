<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\File\Repository;

use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
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

/**
 * durable journal 准入判定（shouldJournalFileTree）的回归测试。
 *
 * # 钉住的故障
 *
 * 沙箱客户端（AGFS）会把 pod 的 /app/.credentials/metadata.json 附到每次建目录/建
 * 文件请求上，于是 MagicFSFileDomainService::createFile 曾把**会话 topic** 落到
 * project 空间的新行上。旧准入要求 project 行 topic_id = 0，于是这些行被整行丢掉 ——
 * 不报错、不落库：沙箱里新建的目录从来没有进过 journal，远端挂载永远无法得知它存在，
 * 目录下新建的文件也就永远解析不出路径。
 *
 * 真实事故（2026-10-09，测试环境）：
 *   sandbox-967073849546354689 建了 10 层目录 + 5 个文件；
 *   sandbox-967073417566597121 读到 50 行变更、其中 10 行无法定位 → unresolved=10，
 *   整份增量被丢弃。那一批目录的 topic_id 正是 967076066626109442（沙箱会话 topic），
 *   而 journal 里属于它们的行数是 0。
 *
 * # 为什么用假连接而不是真库
 *
 * 断言的是「哪些行会进 journal」这一契约，与 SQL 方言、库表状态无关。脚本化行结果的
 * 假连接让「head 不存在 → insert ignore → 重新锁定」这类分支顺序可以被精确描述，
 * 也让负例可以断言"连根解析都没发生"。真实库路径由集成测试覆盖。
 *
 * @internal
 */
class TaskFileRepositoryJournalEligibilityTest extends TestCase
{
    private const CHANGES_TABLE = 'magic_super_agent_task_file_tree_changes';

    private const FILES_TABLE = 'magic_super_agent_task_files';

    /** 事故现场的沙箱会话上下文：metadata.json 里的 topic / task。 */
    private const SESSION_TOPIC_ID = 967076066626109442;

    private const SESSION_TASK_ID = 967076766244339713;

    private const PROJECT_ID = 960242118199775234;

    private const PROJECT_ROOT_ID = 960242119621644289;

    /** 新建目录的父目录（事故里的 大大）。 */
    private const PARENT_DIR_ID = 966820465794473985;

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
     * 事故本身：沙箱建的 project 目录带着会话 topic，仍然必须进 journal。
     *
     * 它是远端挂载认识这个目录的唯一途径：文件行只带 parent_id，父目录没有
     * journal 行就等于父目录不存在，路径永远解析不出来。
     */
    public function testProjectRowWithSessionTopicIsJournaled(): void
    {
        $connection = $this->journalReadyConnection();

        // 与 createFile 同一条写入路径：insert() -> recordFileTreeMutation() -> journal。
        $this->repository()->insert(
            self::projectRow(['file_name' => '第1层', 'is_directory' => 1, 'parent_id' => self::PARENT_DIR_ID])
        );

        $rows = $connection->lastWriteRowsFor(self::CHANGES_TABLE);
        self::assertCount(1, $rows, 'project 行不得因为带会话 topic 而被静默丢弃');
        self::assertSame(self::PROJECT_ROOT_ID, (int) $rows[0]['root_file_id'], 'journal 行必须落在父链解析出的真实根上');
        self::assertSame(self::PARENT_DIR_ID, (int) $rows[0]['parent_id'], 'parent_id 是远端挂载重建路径的唯一线索');
        self::assertSame('第1层', $rows[0]['name']);
        self::assertSame('create', $rows[0]['operation']);
    }

    /**
     * 对照：同一批创建里的文件行（topic_id 被后续写入改回 0）走的是同一条准入，
     * 说明这条契约不区分文件与目录。
     */
    public function testProjectFileRowWithSessionTopicIsJournaled(): void
    {
        $connection = $this->journalReadyConnection(967076817104486401);

        $this->repository()->insert(
            self::projectRow(['file_name' => '星辰.txt', 'is_directory' => 0, 'parent_id' => 967076817104486401])
        );

        $rows = $connection->lastWriteRowsFor(self::CHANGES_TABLE);
        self::assertCount(1, $rows);
        self::assertSame('星辰.txt', $rows[0]['name']);
        self::assertSame(self::PROJECT_ROOT_ID, (int) $rows[0]['root_file_id']);
    }

    /**
     * 负例：没有 project 的行不属于任何可挂载文件树（临时任务附件），
     * 既不能入账，也不该为它花一次父链解析查询。
     */
    public function testProjectRowWithoutProjectIsNeverJournaled(): void
    {
        $connection = (new ArrayRowConnectionStub())->queueSelectRows([self::projectRootRow()]);
        $this->useArrayRowConnection($connection);

        $this->repository()->insert(
            self::projectRow(['project_id' => 0, 'file_name' => 'attachment.bin'])
        );

        self::assertSame([], $connection->lastWriteRowsFor(self::CHANGES_TABLE));
        self::assertFalse($this->resolvedAnyRoot($connection), '不合格的行不该触发根解析');
    }

    /**
     * 负例：topic 空间的树身份就是话题本身，缺了它这行不属于任何树。
     */
    public function testTopicRowWithoutTopicIsNeverJournaled(): void
    {
        $connection = (new ArrayRowConnectionStub())->queueSelectRows([self::projectRootRow()]);
        $this->useArrayRowConnection($connection);

        $this->repository()->insert(
            self::projectRow(['space_type' => FileSpaceType::TOPIC->value, 'topic_id' => 0])
        );

        self::assertSame([], $connection->lastWriteRowsFor(self::CHANGES_TABLE));
        self::assertFalse($this->resolvedAnyRoot($connection));
    }

    /**
     * user 空间的树身份是 (project_id = 0, user_id, organization_code)；
     * topic_id 同样只是来源注解，不能把它挡在 journal 外。
     */
    public function testUserRowWithSessionTopicIsJournaled(): void
    {
        $connection = $this->journalReadyConnection();

        $this->repository()->insert(self::projectRow([
            'space_type' => FileSpaceType::USER->value,
            'project_id' => 0,
            'user_id' => 'usi_520321109128baca91eb8e27072b47b1',
            'organization_code' => 'TGosRaFhvb',
            'file_name' => 'notes.md',
        ]));

        self::assertCount(1, $connection->lastWriteRowsFor(self::CHANGES_TABLE));
    }

    /**
     * 负例：无法归入任何空间的旧数据（space_type 为空）保持现状，不进 journal。
     */
    public function testRowWithoutSpaceTypeIsNeverJournaled(): void
    {
        $connection = (new ArrayRowConnectionStub())->queueSelectRows([self::projectRootRow()]);
        $this->useArrayRowConnection($connection);

        $this->repository()->insert(
            self::projectRow(['space_type' => ''])
        );

        self::assertSame([], $connection->lastWriteRowsFor(self::CHANGES_TABLE));
        self::assertFalse($this->resolvedAnyRoot($connection));
    }

    /**
     * 版本 bump 是缓存失效，不是变更事件：推进 version 但一行 journal 都不写。
     *
     * 这条契约是 feed 体积的分水岭 —— 修复前"每次变更 = 自身行 + 每个祖先一行"，
     * 一次深层写入能产生十来行，其中目录记账占了大多数；现在每一行都对应一个真的
     * 变了的节点。
     */
    public function testBumpMetadataVersionsWritesNoJournalRow(): void
    {
        $connection = new ArrayRowConnectionStub();
        $this->useArrayRowConnection($connection);

        $affected = $this->repository()->bumpMetadataVersions([967076811966464001, 0, null, '966820465794473985']);

        self::assertSame(1, $affected, '影响行数来自 UPDATE 本身');

        $statements = $connection->executedStatements();
        self::assertCount(1, $statements, 'bump 必须是单条语句，不得再读 before/after 镜像');
        self::assertStringContainsString('metadata_version + 1', $statements[0][0]);
        $bound = array_map('intval', $statements[0][1]);
        self::assertContains(967076811966464001, $bound);
        self::assertContains(966820465794473985, $bound);
        self::assertNotContains(0, $bound, '空 id 不参与更新');
        self::assertSame([], $connection->lastWriteRowsFor(self::CHANGES_TABLE), 'bump 不得写 journal 行');
    }

    /**
     * 变更自身的行由变更自己产生：建一个子节点 = 恰好一行（子节点的 create），
     * 不再额外为父目录写一行 update。
     */
    public function testCreatingAChildAppendsExactlyItsOwnRow(): void
    {
        $connection = $this->journalReadyConnection();

        $this->repository()->insert(self::projectRow(['file_name' => '星辰.txt', 'is_directory' => 0]));

        $rows = $connection->lastWriteRowsFor(self::CHANGES_TABLE);
        self::assertCount(1, $rows, '一次变更只能产生一行');
        self::assertSame('create', $rows[0]['operation']);
        self::assertSame(967076811966464001, (int) $rows[0]['file_id']);
    }

    /**
     * 事故现场可用的 journal 状态：项目根的 head 早已存在（子节点不能自建 head），
     * The parent chain is read node by node, then verified before journaling.
     */
    private function journalReadyConnection(int $parentId = self::PARENT_DIR_ID): ArrayRowConnectionStub
    {
        $parentRow = ['file_id' => (string) $parentId, 'parent_id' => (string) self::PROJECT_ROOT_ID, 'is_directory' => 1];
        $connection = (new ArrayRowConnectionStub())->queueSelectRows(
            [$parentRow],
            [self::projectRootRow()],
            [self::projectRootRow(), $parentRow],
            [self::headRow(self::PROJECT_ROOT_ID, 256740)]  // appendFileTreeChanges：锁定 head
        );
        $this->useArrayRowConnection($connection);

        return $connection;
    }

    /**
     * 事故现场的一行 project 目录/文件：space_type = project、project_id > 0，
     * 但带着沙箱会话的 topic_id。
     *
     * @param array<string, mixed> $overrides
     */
    private static function projectRow(array $overrides = []): TaskFileEntity
    {
        return TaskFileEntity::fromRow(array_merge([
            'file_id' => 967076811966464001,
            'file_name' => '第1层',
            'is_directory' => 1,
            'parent_id' => self::PARENT_DIR_ID,
            'project_id' => self::PROJECT_ID,
            'topic_id' => self::SESSION_TOPIC_ID,
            'task_id' => self::SESSION_TASK_ID,
            'user_id' => 'usi_520321109128baca91eb8e27072b47b1',
            'organization_code' => 'TGosRaFhvb',
            'space_type' => FileSpaceType::PROJECT->value,
            'file_key' => 'TGosRaFhvb/project_960242118199775234/workspace/967076811966464001',
            'file_size' => 0,
            'metadata_version' => 1,
            'created_at' => '2026-10-09 14:57:59',
            'updated_at' => '2026-10-09 14:57:59',
        ], $overrides));
    }

    /**
     * A physical root row with a null parent, returned by point reads and verification.
     *
     * @return array<string, mixed>
     */
    private static function projectRootRow(): array
    {
        return [
            'file_id' => (string) self::PROJECT_ROOT_ID,
            'parent_id' => null,
            'is_directory' => 1,
            'space_type' => FileSpaceType::PROJECT->value,
            'project_id' => (string) self::PROJECT_ID,
            'topic_id' => '0',
            'user_id' => 'usi_520321109128baca91eb8e27072b47b1',
            'organization_code' => 'TGosRaFhvb',
        ];
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
            'updated_at' => '2026-10-09 14:58:02',
        ];
    }

    private function repository(): TaskFileRepository
    {
        return new TaskFileRepository(new TaskFileModel());
    }

    /**
     * @return bool whether a parent-chain point read or verification was executed
     */
    private function resolvedAnyRoot(ArrayRowConnectionStub $connection): bool
    {
        foreach ($connection->executedStatements() as [$query]) {
            if (str_starts_with($query, 'SELECT file_id, parent_id, is_directory FROM ' . self::FILES_TABLE . ' WHERE file_id ')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Db 门面走容器里的 ConnectionResolverInterface，Eloquent 模型走
     * Hyperf\Database\Model\Register；两条路径都要指向假连接，测试才不会碰到真库。
     */
    private function useArrayRowConnection(ArrayRowConnectionStub $connection): void
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
}
