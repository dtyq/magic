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
use Hyperf\Snowflake\IdGeneratorInterface;
use Hyperf\Snowflake\Meta;
use HyperfTest\Stub\Domain\SuperMagic\File\ForeignLastInsertIdConnectionStub;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use RuntimeException;
use stdClass;

/**
 * file_id 完整性回归：入库的 ID、返回给挂载端的 ID 必须是同一个雪花 ID。
 *
 * 背景：magic_super_agent_task_files.file_id 由调用方显式赋雪花 ID（建表时虽然是
 * bigIncrements，但线上 INSERT 一定带 file_id，MySQL 不会为该语句生成自增值）。若模型按
 * 自增模型插入（Eloquent 默认），插入后会把 PDO::lastInsertId() —— 这条复用连接上最近一次
 * 自增插入的残留值，可能来自任何表 —— 写回主键属性。MagicFS 创建接口一旦把这个残留值当
 * file.id 返回，挂载端（版本树 / xattr / LocalFileCache / change journal）会一直用它做
 * 后续元数据调用，服务端按 file_id 查不到 → 51300 文件不存在 → 表现为「写入文件 遇到问题，
 * 正在尝试其他方式」，而重新解析路径拿到真 ID 后又恢复正常。
 *
 * @internal
 */
class TaskFileRepositoryInsertFileIdTest extends TestCase
{
    /** 调用方赋给新文件的雪花 ID（同时也是它的 object_key 尾段）。 */
    private const SNOWFLAKE = 960196853371441154;

    /** 连接上残留的、来自别的表的自增值：就是线上被当成 file.id 返回的那个 928612。 */
    private const FOREIGN_LAST_INSERT_ID = 928612;

    /** ensureFileId() 在不带 ID 时补出来的雪花 ID。 */
    private const GENERATED_SNOWFLAKE = 960196899588440065;

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
     * 根因：模型不能按自增模型插入，否则 Eloquent 用连接上的残留自增值覆盖显式雪花 ID。
     * 把 $incrementing 改回 true（或删掉声明）这里就会退化成 928612。
     */
    public function testModelInsertKeepsExplicitSnowflakeInsteadOfLastInsertId(): void
    {
        $this->useDatabase((new ForeignLastInsertIdConnectionStub())->queueForeignLastInsertId(self::FOREIGN_LAST_INSERT_ID));

        $model = (new TaskFileModel())->newQuery()->create([
            'file_id' => self::SNOWFLAKE,
            'user_id' => 'usi_test',
            'organization_code' => 'DT001',
            'project_id' => 42,
            'topic_id' => 0,
            'task_id' => 1,
            'file_name' => '.magic',
            'file_key' => 'DT001/1/project_42/workspace/' . self::SNOWFLAKE,
            'space_type' => 'project',
        ]);

        self::assertSame(
            self::SNOWFLAKE,
            (int) $model->file_id,
            '模型主键必须保持调用方显式赋的雪花 ID，不能被 PDO::lastInsertId() 覆盖'
        );
    }

    /**
     * 仓库层：insert() 返回的实体必须带回调用方的雪花 ID。旧代码把它换成 $model->file_id，
     * 于是 MagicFS 创建接口把连接上残留的 928612 当 file.id 返回。
     */
    public function testInsertReturnsCallerSuppliedSnowflakeFileId(): void
    {
        $this->useDatabase(
            (new ForeignLastInsertIdConnectionStub())
                ->queueForeignLastInsertId(self::FOREIGN_LAST_INSERT_ID)
                ->queueSelectRows([], [self::headRow(self::SNOWFLAKE, 0)])
        );

        $entity = self::rootDirectory(self::SNOWFLAKE);
        $saved = $this->repository()->insert($entity);

        self::assertSame(
            self::SNOWFLAKE,
            $saved->getFileId(),
            'MagicFS 创建响应里的 file_id 必须与入库值一致，否则挂载端后续按 ID 的操作全部 404'
        );
    }

    /**
     * 不带 ID 的调用方（导入、历史代码）由 PHP 侧补雪花 ID，不再依赖数据库自增：
     * 依赖自增时实体拿不到生成值，响应、change journal 都会带着 0。
     */
    public function testInsertAssignsSnowflakeFileIdWhenCallerSuppliedNone(): void
    {
        $this->useDatabase(
            (new ForeignLastInsertIdConnectionStub())
                ->queueForeignLastInsertId(self::FOREIGN_LAST_INSERT_ID)
                ->queueSelectRows([], [self::headRow(self::GENERATED_SNOWFLAKE, 0)]),
            self::GENERATED_SNOWFLAKE
        );

        $saved = $this->repository()->insert(self::rootDirectory(0));

        self::assertSame(self::GENERATED_SNOWFLAKE, $saved->getFileId());
    }

    /**
     * change journal 的 file_snapshot 必须把空 file_metadata 写成 {}：Go 侧
     * File.FileMetadata 是 map[string]string，写成 [] 会让整页 change feed 解码失败
     * （线上每秒一条 "cannot unmarshal array into ... file_metadata"），挂载端同步停在原地。
     */
    public function testJournalSnapshotSerializesEmptyFileMetadataAsObject(): void
    {
        $connection = (new ForeignLastInsertIdConnectionStub())
            ->queueForeignLastInsertId(self::FOREIGN_LAST_INSERT_ID)
            ->queueSelectRows([], [self::headRow(self::SNOWFLAKE, 0)]);
        $this->useDatabase($connection);

        $this->repository()->insert(self::rootDirectory(self::SNOWFLAKE));

        $rows = $connection->lastWriteRowsFor(self::CHANGES_TABLE);
        self::assertCount(1, $rows, 'insert() 必须为新建节点写一条 journal 行');

        $snapshotJson = $rows[0]['file_snapshot'];
        self::assertIsString($snapshotJson);
        self::assertStringContainsString('"file_metadata":{}', $snapshotJson);

        $snapshot = json_decode($snapshotJson, false, 512, JSON_THROW_ON_ERROR);
        self::assertInstanceOf(
            stdClass::class,
            $snapshot->file_metadata,
            '空 file_metadata 必须是 JSON object，不能是 JSON 数组'
        );
    }

    /**
     * Db 门面走容器里的 ConnectionResolverInterface，Eloquent 模型走
     * Hyperf\Database\Model\Register，两条路径都要指向假连接，测试才不会碰到真库。
     */
    private function useDatabase(ForeignLastInsertIdConnectionStub $connection, ?int $generatedSnowflake = null): void
    {
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($connection);

        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(
            static fn (string $id) => match ($id) {
                Db::class => new Db($container),
                ConnectionResolverInterface::class => $resolver,
                IdGeneratorInterface::class => new class($generatedSnowflake ?? 0) implements IdGeneratorInterface {
                    public function __construct(private int $id)
                    {
                    }

                    public function generate(?Meta $meta = null): int
                    {
                        return $this->id;
                    }

                    public function degenerate(int $id): Meta
                    {
                        throw new RuntimeException('degenerate() is not used by this test');
                    }
                },
                default => null,
            }
        );

        ApplicationContext::setContainer($container);
        Register::setConnectionResolver($resolver);
    }

    private function repository(): TaskFileRepository
    {
        return new TaskFileRepository(new TaskFileModel());
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

    /**
     * 项目空间根目录：journal 的 root_file_id 就是它自己的 file_id，无需再查父链。
     */
    private static function rootDirectory(int $fileId): TaskFileEntity
    {
        return TaskFileEntity::fromRow([
            'file_id' => $fileId,
            'file_name' => 'project_root',
            'is_directory' => 1,
            'parent_id' => null,
            'project_id' => 42,
            'topic_id' => 0,
            'space_type' => 'project',
            'metadata_version' => 1,
        ]);
    }
}
