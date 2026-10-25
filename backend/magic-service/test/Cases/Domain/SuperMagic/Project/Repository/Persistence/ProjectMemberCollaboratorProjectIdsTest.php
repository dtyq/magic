<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Project\Repository\Persistence;

use App\Domain\SuperMagic\Project\Repository\Model\ProjectMemberModel;
use App\Domain\SuperMagic\Project\Repository\Persistence\ProjectMemberRepository;
use Hyperf\Database\ConnectionInterface;
use Hyperf\Database\Model\Builder as ModelBuilder;
use Hyperf\Database\Query\Builder as QueryBuilder;
use Hyperf\Database\Query\Grammars\MySqlGrammar;
use Hyperf\Database\Query\Processors\Processor;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * @internal
 */
final class ProjectMemberCollaboratorProjectIdsTest extends TestCase
{
    public function testPluckSkipsModelHydrationAndReturnsInts(): void
    {
        $model = $this->makeModel([['project_id' => '101'], ['project_id' => '102'], ['project_id' => '103']]);
        $repository = new ProjectMemberRepository($model);

        $result = $repository->getProjectIdsByCollaboratorTargets(['u1', 'u2'], [1, 2]);

        self::assertSame([101, 102, 103], $result);
        self::assertSame(0, $model::$hydratedCount, '不应逐行实例化模型（会触发 retrieved 事件）');
        self::assertStringContainsString('distinct', strtolower($model::$lastSql));
        self::assertStringContainsString('`target_id` in', $model::$lastSql);
        self::assertStringContainsString('`role` in', $model::$lastSql);
    }

    public function testEmptyTargetIdsReturnsEmptyWithoutQuery(): void
    {
        $model = $this->makeModel([]);
        $repository = new ProjectMemberRepository($model);

        self::assertSame([], $repository->getProjectIdsByCollaboratorTargets([], [1]));
        self::assertSame('', $model::$lastSql);
    }

    public function testNoRowsReturnsEmptyArray(): void
    {
        $repository = new ProjectMemberRepository($this->makeModel([]));

        self::assertSame([], $repository->getProjectIdsByCollaboratorTargets(['u1'], [1]));
    }

    private function makeModel(array $rows): ProjectMemberModel
    {
        $connection = $this->createMock(ConnectionInterface::class);
        $connection->method('select')->willReturnCallback(function (string $sql) use ($rows) {
            FakeProjectMemberModel::$lastSql = $sql;
            return array_map(static fn (array $row) => (object) $row, $rows);
        });

        FakeProjectMemberModel::$connectionMock = $connection;
        FakeProjectMemberModel::$hydratedCount = 0;
        FakeProjectMemberModel::$lastSql = '';

        // 跳过构造函数：Model 构造会触发 booting 事件，依赖容器
        return (new ReflectionClass(FakeProjectMemberModel::class))->newInstanceWithoutConstructor();
    }
}

/**
 * 用 mock 连接构造 Builder，并统计模型被 hydrate 的次数.
 */
class FakeProjectMemberModel extends ProjectMemberModel
{
    public static ?ConnectionInterface $connectionMock = null;

    public static int $hydratedCount = 0;

    public static string $lastSql = '';

    public function newFromBuilder($attributes = [], $connection = null)
    {
        ++self::$hydratedCount;
        return parent::newFromBuilder($attributes, $connection);
    }

    public static function query()
    {
        // 父类 query() 会 new static()，构造函数依赖容器，这里跳过
        return (new ReflectionClass(static::class))->newInstanceWithoutConstructor()->newQuery();
    }

    public function newQuery()
    {
        $base = new QueryBuilder(self::$connectionMock, new MySqlGrammar(), new Processor());
        return (new ModelBuilder($base))->setModel($this)->from($this->getTable());
    }
}
