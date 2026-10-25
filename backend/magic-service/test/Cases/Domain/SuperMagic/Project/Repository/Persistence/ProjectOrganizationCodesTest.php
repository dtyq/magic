<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Project\Repository\Persistence;

use App\Domain\SuperMagic\Project\Repository\Model\ProjectModel;
use App\Domain\SuperMagic\Project\Repository\Persistence\ProjectRepository;
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
final class ProjectOrganizationCodesTest extends TestCase
{
    public function testLargeProjectIdsAreQueriedInChunksAndMerged(): void
    {
        $repository = new ProjectRepository($this->makeModel());

        $ids = range(1, 2500);
        $result = $repository->getOrganizationCodesByProjectIds($ids);

        self::assertCount(3, FakeProjectModel::$queries, '2500 个 id 应按 1000 分成 3 次查询');
        self::assertSame(['org_a', 'org_b'], $result, '各分块结果需合并去重');
    }

    public function testDuplicateIdsAreDeduplicatedBeforeChunking(): void
    {
        $repository = new ProjectRepository($this->makeModel());

        $repository->getOrganizationCodesByProjectIds(array_fill(0, 5000, 7));

        self::assertCount(1, FakeProjectModel::$queries);
    }

    public function testEmptyIdsDoNotQuery(): void
    {
        $repository = new ProjectRepository($this->makeModel());

        self::assertSame([], $repository->getOrganizationCodesByProjectIds([]));
        self::assertCount(0, FakeProjectModel::$queries);
    }

    private function makeModel(): ProjectModel
    {
        $connection = $this->createMock(ConnectionInterface::class);
        $connection->method('select')->willReturnCallback(function (string $sql) {
            FakeProjectModel::$queries[] = $sql;
            // 每个分块交替返回，验证合并去重
            return [(object) ['user_organization_code' => count(FakeProjectModel::$queries) % 2 ? 'org_a' : 'org_b']];
        });
        FakeProjectModel::$connectionMock = $connection;
        FakeProjectModel::$queries = [];

        return (new ReflectionClass(FakeProjectModel::class))->newInstanceWithoutConstructor();
    }
}

class FakeProjectModel extends ProjectModel
{
    public static ?ConnectionInterface $connectionMock = null;

    public static array $queries = [];

    public static function query()
    {
        return (new ReflectionClass(static::class))->newInstanceWithoutConstructor()->newQuery();
    }

    public function newQuery()
    {
        $base = new QueryBuilder(self::$connectionMock, new MySqlGrammar(), new Processor());
        return (new ModelBuilder($base))->setModel($this)->from($this->getTable());
    }
}
