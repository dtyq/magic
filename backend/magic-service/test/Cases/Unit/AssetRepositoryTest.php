<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\ProviderAssetEntity;
use App\Domain\Asset\Entity\ValueObject\AssetScope;
use App\Domain\Asset\Entity\ValueObject\AssetVisibilityType;
use App\Domain\Asset\Entity\ValueObject\Query\AssetQuery;
use App\Domain\Asset\Repository\Facade\AssetProviderAssetRepositoryInterface;
use App\Domain\Asset\Repository\Facade\AssetRepositoryInterface;
use App\Domain\Asset\Repository\Persistence\AssetProviderAssetRepository;
use App\Domain\Asset\Repository\Persistence\AssetRepository;
use App\Domain\Asset\Repository\Persistence\Model\AssetModel;
use App\Domain\Asset\Repository\Persistence\Model\AssetProviderAssetModel;
use Closure;
use Hyperf\Context\ApplicationContext;
use Hyperf\Database\Model\Builder;
use Hyperf\Snowflake\IdGeneratorInterface;
use Hyperf\Snowflake\Meta;
use InvalidArgumentException;
use LogicException;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionMethod;
use ReflectionParameter;

/**
 * @internal
 */
final class AssetRepositoryTest extends TestCase
{
    public function testAssetModelExposesTenantAndAssetFields(): void
    {
        $reflection = new ReflectionClass(AssetModel::class);
        $fillable = $reflection->getProperty('fillable')->getDefaultValue();
        $casts = $reflection->getProperty('casts')->getDefaultValue();

        self::assertContains('organization_code', $fillable);
        self::assertContains('user_id', $fillable);
        self::assertContains('asset_kind', $fillable);
        self::assertContains('asset_business_type', $fillable);
        self::assertContains('asset_media_type', $fillable);
        self::assertContains('parent_id', $fillable);
        self::assertSame('array', $casts['name_i18n']);
        self::assertSame('boolean', $casts['status']);

        $providerReflection = new ReflectionClass(AssetProviderAssetModel::class);
        $providerFillable = $providerReflection->getProperty('fillable')->getDefaultValue();
        self::assertContains('provider_code', $providerFillable);
        self::assertContains('project_name', $providerFillable);
    }

    public function testAssetKindDefaultsToAssetAndRejectsUnknownValues(): void
    {
        self::assertSame('ASSET', AssetModel::normalizeAssetKind(null));
        self::assertSame('ASSET', AssetModel::normalizeAssetKind(''));
        self::assertSame('GROUP', AssetModel::normalizeAssetKind('GROUP'));
        $this->expectException(InvalidArgumentException::class);
        AssetModel::normalizeAssetKind('UNKNOWN');
    }

    public function testProviderUpsertPayloadContainsIdempotencyKeyAndTimestamps(): void
    {
        $this->useFakeSnowflakeId();
        $payload = AssetProviderAssetRepository::buildMappingPayload(
            new ProviderAssetEntity([
                'organization_code' => 'org-a',
                'asset_id' => 9,
                'provider_code' => 'ark',
                'provider_asset_id' => 'provider-1',
                'project_name' => 'project-a',
            ]),
            '2026-09-13 12:00:00',
        );
        self::assertIsInt($payload['id']);
        self::assertSame('org-a', $payload['organization_code']);
        self::assertSame(9, $payload['asset_id']);
        self::assertSame('ark', $payload['provider_code']);
        self::assertSame('project-a', $payload['project_name']);
        self::assertSame('2026-09-13 12:00:00', $payload['updated_at']);
        self::assertNull($payload['deleted_at']);
    }

    /**
     * 回归：upsert 走查询构造器，模型上的 `array` cast 不生效，
     * 数组直接绑给 PDO 会在拼接错误消息时抛 `Array to string conversion`。
     */
    public function testProviderUpsertPayloadEncodesMetadataAsJsonString(): void
    {
        $this->useFakeSnowflakeId();
        $rawResponse = [
            'ResponseMetadata' => ['RequestId' => 'req-1', 'Action' => 'CreateAsset'],
            'Result' => ['Id' => 'asset-1', 'Status' => 'Active'],
            '中文键' => '中文值',
        ];

        $payload = AssetProviderAssetRepository::buildMappingPayload(
            new ProviderAssetEntity([
                'organization_code' => 'org-a',
                'asset_id' => 9,
                'provider_code' => 'ark',
                'project_name' => 'default',
                'metadata' => $rawResponse,
            ]),
            '2026-09-13 12:00:00',
        );

        self::assertIsString($payload['metadata']);
        self::assertSame($rawResponse, json_decode($payload['metadata'], true, 512, JSON_THROW_ON_ERROR));
        // 所有列值都必须是 PDO 能直接绑定的标量或 null，这是 upsert 不炸的硬前提。
        foreach ($payload as $column => $value) {
            self::assertTrue($value === null || is_scalar($value), sprintf('列 %s 不是标量', $column));
        }
    }

    public function testProviderUpsertPayloadLeavesMissingMetadataNull(): void
    {
        $this->useFakeSnowflakeId();
        $payload = AssetProviderAssetRepository::buildMappingPayload(
            new ProviderAssetEntity(['asset_id' => 9, 'provider_code' => 'ark', 'project_name' => 'default']),
            '2026-09-13 12:00:00',
        );

        // 空数组也落 null，避免 json 列里出现无意义的 '[]'。
        self::assertNull($payload['metadata']);
    }

    public function testRepositoryContractsExposeIdempotentOperations(): void
    {
        self::assertTrue(method_exists(AssetRepositoryInterface::class, 'save'));
        self::assertTrue(method_exists(AssetRepositoryInterface::class, 'queries'));
        self::assertTrue(method_exists(AssetRepositoryInterface::class, 'findById'));
        self::assertTrue(method_exists(AssetRepositoryInterface::class, 'delete'));
        self::assertTrue(method_exists(AssetProviderAssetRepositoryInterface::class, 'saveMapping'));
        $providerReflection = new ReflectionMethod(AssetProviderAssetRepositoryInterface::class, 'saveMapping');
        self::assertSame('dataIsolation', $providerReflection->getParameters()[0]->getName());
        self::assertSame('providerAsset', $providerReflection->getParameters()[1]->getName());
    }

    public function testRepositoryContractsExposeContentHashAndHierarchyQueries(): void
    {
        self::assertTrue(method_exists(AssetRepositoryInterface::class, 'hasChildren'));
        self::assertTrue(method_exists(AssetProviderAssetRepositoryInterface::class, 'findPassedMappingByContentHash'));

        $hashReflection = new ReflectionMethod(AssetProviderAssetRepositoryInterface::class, 'findPassedMappingByContentHash');
        $hashParams = array_map(
            static fn (ReflectionParameter $parameter): string => $parameter->getName(),
            $hashReflection->getParameters(),
        );
        self::assertSame(['contentHash', 'providerCode', 'organizationCode', 'userId'], $hashParams);

        $childrenReflection = new ReflectionMethod(AssetRepositoryInterface::class, 'hasChildren');
        $childrenParams = array_map(
            static fn (ReflectionParameter $parameter): string => $parameter->getName(),
            $childrenReflection->getParameters(),
        );
        self::assertSame(['dataIsolation', 'assetId'], $childrenParams);
    }

    public function testAssetQueryContractRequiresOrganizationAndSupportsKindParentFilters(): void
    {
        $method = new ReflectionMethod(AssetRepositoryInterface::class, 'queries');
        $names = array_map(static fn (ReflectionParameter $parameter): string => $parameter->getName(), $method->getParameters());
        self::assertSame(['dataIsolation', 'query', 'page'], $names);
    }

    public function testRepositoryContractsExposePersonalContentHashQuery(): void
    {
        self::assertTrue(method_exists(AssetRepositoryInterface::class, 'findPersonalAssetByContentHash'));

        $reflection = new ReflectionMethod(AssetRepositoryInterface::class, 'findPersonalAssetByContentHash');
        $params = array_map(
            static fn (ReflectionParameter $parameter): string => $parameter->getName(),
            $reflection->getParameters(),
        );
        self::assertSame(['userId', 'contentHash', 'anySyncStatus'], $params);

        $returnType = $reflection->getReturnType();
        self::assertNotNull($returnType);
        self::assertTrue($returnType->allowsNull());
        self::assertSame('App\Domain\Asset\Entity\AssetEntity', $returnType->getName());
    }

    /**
     * 四种查询范围的条件拼装。
     *
     * 个人范围按「归属人 + 可见类型」双条件判定，两者缺一不可。
     *
     * 这里刻意传入 Model\Builder 的 mock：仓储的过滤器形参必须是它（模型查询返回的实例），
     * 写成 Query\Builder 会在运行时抛 TypeError——本用例就是这条约定的回归护栏。
     * 过滤器只读隔离对象的当前用户，用 mock 隔离对象即可，不必构造真实实例（会依赖容器）。
     */
    public function testApplyScopeFilterBuildsConditionsPerScope(): void
    {
        $isolation = $this->assetDataIsolation();

        $personal = [];
        $this->recordScopeFilter(AssetScope::PERSONAL, [], $isolation, $personal);
        self::assertSame([
            ['where', ['owner_uid', 'user-1']],
            ['where', ['visibility_type', AssetVisibilityType::PERSONAL->value]],
        ], $personal);

        // 官方资产的判定仍然是 user_id IS NULL，不受归属人字段改名影响。
        $public = [];
        $this->recordScopeFilter(AssetScope::PUBLIC, [], $isolation, $public);
        self::assertSame([['whereNull', ['user_id']]], $public);

        // 团队分享：闭包内是「我创建的 OR 授权给我的」，闭包外再限定可见类型为团队分享。
        $team = [];
        $nested = $this->recordScopeFilter(AssetScope::TEAM, ['7', '9'], $isolation, $team);
        self::assertCount(2, $team);
        self::assertSame('where', $team[0][0]);
        self::assertInstanceOf(Closure::class, $team[0][1][0]);
        self::assertSame([
            ['where', ['visibility_type', AssetVisibilityType::TEAM->value]],
        ], array_slice($team, 1));
        self::assertSame([
            ['where', ['owner_uid', 'user-1']],
            ['orWhereIn', ['id', ['7', '9']]],
        ], $nested);

        // 空授权集时不产生空的 orWhereIn：闭包里只剩「我创建的」这一条。
        $teamEmpty = [];
        $nestedEmpty = $this->recordScopeFilter(AssetScope::TEAM, [], $isolation, $teamEmpty);
        self::assertSame([['where', ['owner_uid', 'user-1']]], $nestedEmpty);
    }

    /**
     * 全部范围 = 个人 ∪ 团队分享：外层套一个分组闭包，闭包内是「我创建的 OR 授权给我的」，
     * 闭包外再限定可见类型属于这两种范围之一。
     */
    public function testApplyScopeFilterWrapsPersonalAndSharedInNestedGroup(): void
    {
        $isolation = $this->assetDataIsolation();

        $outer = [];
        $inner = $this->recordScopeFilter(AssetScope::ALL, ['7'], $isolation, $outer);
        self::assertCount(2, $outer);
        self::assertSame('where', $outer[0][0]);
        self::assertInstanceOf(Closure::class, $outer[0][1][0]);
        self::assertSame([[
            'whereIn',
            ['visibility_type', [AssetVisibilityType::PERSONAL->value, AssetVisibilityType::TEAM->value]],
        ]], array_slice($outer, 1));
        self::assertSame([
            ['where', ['owner_uid', 'user-1']],
            ['orWhereIn', ['id', ['7']]],
        ], $inner);

        // 没有授权资产时不产生空的 orWhereIn。
        $outerEmpty = [];
        $innerEmpty = $this->recordScopeFilter(AssetScope::ALL, [], $isolation, $outerEmpty);
        self::assertSame([['where', ['owner_uid', 'user-1']]], $innerEmpty);
    }

    /**
     * 调仓储私有的范围过滤器，收集它加到 builder 上的条件；返回内部闭包（若有）执行后收集到的条件。
     *
     * @param array<string> $sharedAssetIds
     * @param array<array{0: string, 1: array}> $calls
     * @return array<array{0: string, 1: array}>
     */
    private function recordScopeFilter(
        AssetScope $scope,
        array $sharedAssetIds,
        AssetDataIsolation $isolation,
        array &$calls,
    ): array {
        $query = new AssetQuery();
        $query->setScope($scope);
        $query->setSharedAssetIds($sharedAssetIds);

        $builder = $this->recordingBuilder($calls);
        $method = new ReflectionMethod(AssetRepository::class, 'applyScopeFilter');
        $method->invoke(new AssetRepository($this->createMock(AssetModel::class)), $builder, $isolation, $query);

        foreach ($calls as $call) {
            if ($call[0] === 'where' && $call[1] !== [] && $call[1][0] instanceof Closure) {
                $nestedCalls = [];
                $call[1][0]($this->recordingBuilder($nestedCalls));
                return $nestedCalls;
            }
        }
        return [];
    }

    /**
     * whereIn/whereNull 之类没有显式实现，是 Model\Builder::__call 转发给底层查询构造器的，
     * 因此除了 where，还要拦 __call 才能把条件记下来。
     *
     * @param array<array{0: string, 1: array}> $calls
     */
    private function recordingBuilder(array &$calls): Builder
    {
        $builder = $this->createMock(Builder::class);
        $builder->method('where')->willReturnCallback(
            static function (...$arguments) use (&$calls, $builder) {
                $calls[] = ['where', self::withoutDefaultArguments($arguments)];
                return $builder;
            }
        );
        $builder->method('__call')->willReturnCallback(
            static function (string $method, array $arguments) use (&$calls, $builder) {
                $calls[] = [$method, self::withoutDefaultArguments($arguments)];
                return $builder;
            }
        );
        return $builder;
    }

    /**
     * 生成的 mock 会把 `where($column, $operator = null, $value = null, $boolean = 'and')`
     * 的默认值一并传进来，这里裁掉它们，断言才能只表达调用点真正传入的条件。
     */
    private static function withoutDefaultArguments(array $arguments): array
    {
        while ($arguments !== []) {
            $last = end($arguments);
            if ($last === null || $last === 'and') {
                array_pop($arguments);
                continue;
            }
            break;
        }
        return array_values($arguments);
    }

    /**
     * 过滤器只读当前用户，mock 掉即可，避免真实隔离对象去碰容器里的配置。
     */
    private function assetDataIsolation(): AssetDataIsolation
    {
        $isolation = $this->createMock(AssetDataIsolation::class);
        $isolation->method('getCurrentUserId')->willReturn('user-1');
        return $isolation;
    }

    /**
     * 固定雪花 ID，避免单测依赖真实容器。
     *
     * 只劫持 IdGeneratorInterface，其余解析一律回落到原容器——这个替换是全局静态的，
     * 若无脑返回假 ID 生成器，后面所有用例（app_env() 之类）都会解析到错误实例而报错。
     */
    private function useFakeSnowflakeId(): void
    {
        $previous = ApplicationContext::getContainer();
        ApplicationContext::setContainer(new class($previous) implements ContainerInterface {
            public function __construct(private readonly ContainerInterface $previous)
            {
            }

            public function get(string $id): object
            {
                if ($id !== IdGeneratorInterface::class) {
                    return $this->previous->get($id);
                }
                return new class implements IdGeneratorInterface {
                    public function generate(?Meta $meta = null): int
                    {
                        return 123;
                    }

                    public function degenerate(int $id): Meta
                    {
                        throw new LogicException();
                    }
                };
            }

            public function has(string $id): bool
            {
                return $id === IdGeneratorInterface::class || $this->previous->has($id);
            }

            public function make(string $name, array $parameters = []): mixed
            {
                if ($name === IdGeneratorInterface::class) {
                    return $this->get($name);
                }
                // Hyperf\Support\make() 会先看容器有没有 make：原容器是 Hyperf\Di\Container（有），
                // PSR 接口里没声明，所以这里显式转发，否则会退化成反射 new 接口而报错。
                return method_exists($this->previous, 'make')
                    ? $this->previous->make($name, $parameters)
                    : $this->previous->get($name);
            }
        });
    }
}
