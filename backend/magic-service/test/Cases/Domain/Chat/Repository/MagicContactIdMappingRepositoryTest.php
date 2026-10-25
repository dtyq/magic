<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Chat\Repository;

use App\Domain\Chat\Repository\Persistence\MagicContactIdMappingRepository;
use App\Domain\Chat\Repository\Persistence\Model\MagicContactThirdPlatformIdMappingModel;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use Hyperf\Database\ConnectionInterface;
use Hyperf\Database\Model\Builder as ModelBuilder;
use Hyperf\Database\Model\Collection;
use Hyperf\Database\Query\Builder as QueryBuilder;
use Hyperf\Database\Query\Grammars\MySqlGrammar;
use Hyperf\Database\Query\Processors\Processor;
use PHPUnit\Framework\TestCase;

/**
 * 验证真实查询构建器生成的隔离条件，连接和结果均为 Mock。
 * @internal
 */
final class MagicContactIdMappingRepositoryTest extends TestCase
{
    /**
     * 即使是历史宽查询平台也必须限定当前组织、有效环境和软删除状态。
     */
    public function testScopedQueryKeepsAllIdentityBoundaries(): void
    {
        $row = ['origin_id' => '00123', 'new_id' => 'mock-account'];
        $connection = $this->createMock(ConnectionInterface::class);
        $connection->expects(self::once())->method('select')->willReturnCallback(
            static function (string $sql, array $bindings) use ($row): array {
                foreach (['`new_id` = ?', '`mapping_type` = ?', '`magic_organization_code` = ?', '`third_platform_type` = ?', '`magic_environment_id` in (?, ?)', '`deleted_at` is null'] as $condition) {
                    self::assertStringContainsString($condition, $sql);
                }
                self::assertSame(['mock-account', 'user', 'mock-org', 'teamshare', 8, 7], $bindings);
                return [(object) $row];
            }
        );
        $model = $this->createMock(MagicContactThirdPlatformIdMappingModel::class);
        $record = $this->createMock(MagicContactThirdPlatformIdMappingModel::class);
        $record->method('toArray')->willReturn($row);
        $records = new Collection([$record]);
        $model->method('__call')->with('hydrate', [[(object) $row]])->willReturn($records);
        $model->method('newCollection')->willReturn($records);
        $query = (new ModelBuilder(new QueryBuilder($connection, new MySqlGrammar(), new Processor())))
            ->setModel($model)->from('magic_contact_third_platform_id_mapping');
        $model->method('newQuery')->willReturn($query);
        $environment = new MagicEnvironmentEntity(['id' => 7, 'extra' => ['relation_env_ids' => [8, 8, -1, 'invalid']]]);
        $mappings = (new MagicContactIdMappingRepository($model))->getScopedUserIdsMapping($environment, 'mock-account', 'mock-org', PlatformType::Teamshare);
        self::assertCount(1, $mappings);
        self::assertSame('00123', $mappings[0]->getOriginId());
        self::assertSame('mock-account', $mappings[0]->getNewId());
    }

    /**
     * 缺失查询范围时不得访问数据库。
     */
    public function testMissingScopeDoesNotQuery(): void
    {
        $model = $this->createMock(MagicContactThirdPlatformIdMappingModel::class);
        $model->expects(self::never())->method('newQuery');
        $repository = new MagicContactIdMappingRepository($model);
        self::assertSame([], $repository->getScopedUserIdsMapping(new MagicEnvironmentEntity(['id' => 0]), 'mock-account', 'mock-org', PlatformType::FeiShu));
        self::assertSame([], $repository->getScopedUserIdsMapping(new MagicEnvironmentEntity(['id' => 7]), '', 'mock-org', PlatformType::FeiShu));
    }
}
