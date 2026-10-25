<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\MagicBase\Service;

use App\Domain\MagicBase\Entity\MagicBaseColumnEntity;
use App\Domain\MagicBase\Entity\MagicBaseColumnPermissionEntity;
use App\Domain\MagicBase\Entity\MagicBaseTableEntity;
use App\Domain\MagicBase\Entity\ValueObject\ActorContext;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseAccessContext;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseColumnIndex;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseEntityCollection;
use App\Domain\MagicBase\Entity\ValueObject\MagicBasePermissionIndex;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseRowQuery;
use App\Domain\MagicBase\Exception\MagicBaseColumnAccessDeniedException;
use App\Domain\MagicBase\Exception\MagicBaseInvalidFilterException;
use App\Domain\MagicBase\Repository\Persistence\Storage\MongoDB\MagicBaseMongoQueryCompiler;
use App\Domain\MagicBase\Repository\Persistence\Storage\MongoDB\MagicBaseMongoRowQueryRepository;
use App\Domain\MagicBase\Service\MagicBaseRowFilterDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowQueryCriteriaDomainService;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;

/** @internal */
final class MagicBaseColumnQueryPermissionTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        ApplicationContext::setContainer($this->createMock(ContainerInterface::class));
    }

    protected function tearDown(): void
    {
        (new ReflectionClass(ApplicationContext::class))->getProperty('container')->setValue(null, $this->previousContainer);
    }

    #[DataProvider('deniedQueries')]
    public function testHiddenColumnsCannotBeUsedInQueries(string $userId, array $filter, array $sort): void
    {
        $this->expectException(MagicBaseColumnAccessDeniedException::class);
        $this->query('disabled', new ActorContext($userId, 'org'), $filter, $sort);
    }

    public static function deniedQueries(): array
    {
        $cases = [];
        foreach (['', 'reader'] as $actor) {
            $cases[] = [$actor, ['secret' => ['eq' => 'guess']], []];
            $cases[] = [$actor, ['logic' => 'or', 'items' => [['field' => 'secret', 'operator' => 'eq', 'value' => 'guess']]], []];
            $cases[] = [$actor, [], [['field' => 'secret', 'order' => 'asc']]];
        }
        return $cases;
    }

    #[DataProvider('privateScopes')]
    public function testPrivateColumnRestrictsRowsBeforeFilteringCountingAndSorting(string $scope, array $constraint): void
    {
        $query = $this->query($scope, new ActorContext('reader', 'org', ['department']), ['secret' => ['eq' => 'guess']], [['field' => 'secret', 'order' => 'asc']]);
        self::assertSame(['$and' => [
            ['$and' => [$this->baseFilter(), $constraint]],
            ['data.secret' => 'guess'],
        ]], $this->compile($query));
    }

    public static function privateScopes(): array
    {
        return [
            ['private_user', ['created_by' => 'reader']],
            ['private_org', ['organization_code' => 'org']],
            ['private_department', ['owner_department_ids' => ['$in' => ['department']]]],
        ];
    }

    public function testStaticRowGrantDoesNotOverrideColumnScope(): void
    {
        $query = $this->query('private_user', new ActorContext('reader', 'org'), [], [['field' => 'secret']], false, false, 'disabled', [99]);
        self::assertSame(['$and' => [
            ['$and' => [$this->baseFilter(), ['$or' => [['record_id' => ['$in' => [99]]]]]]],
            ['created_by' => 'reader'],
        ]], $this->compile($query));
    }

    public function testManagerAndExplicitColumnGrantRetainQueryAccess(): void
    {
        foreach ([[true, false], [false, true]] as [$manager, $grant]) {
            $query = $this->query('disabled', new ActorContext('reader', 'org'), ['secret' => ['eq' => 'guess']], [], $manager, $grant);
            self::assertSame(['$and' => [$this->baseFilter(), ['data.secret' => 'guess']]], $this->compile($query));
        }
    }

    public function testUnknownSortFieldIsRejectedForAuthenticatedUsers(): void
    {
        $this->expectException(MagicBaseInvalidFilterException::class);
        $this->query('public', new ActorContext('reader', 'org'), [], [['field' => 'unknown']]);
    }

    public function testInternalRelationKeysMustAlsoBeReadable(): void
    {
        $column = new MagicBaseColumnEntity(['id' => 10, 'column_key' => 'secret', 'data_type' => 'text', 'dynamic_permission' => ['read_scope' => 'disabled']]);
        $access = new MagicBaseAccessContext(new MagicBaseColumnIndex(['secret' => $column]), new MagicBaseEntityCollection(), new MagicBaseEntityCollection(), new MagicBaseEntityCollection(), new MagicBasePermissionIndex([]), new MagicBasePermissionIndex([]), false);
        $this->expectException(MagicBaseColumnAccessDeniedException::class);
        (new MagicBaseRowQueryCriteriaDomainService(new MagicBaseRowFilterDomainService()))->buildReadableQuery('org', new MagicBaseTableEntity(), $access, new ActorContext('reader', 'org'), ['record_id' => ['eq' => 1]], [], 1, 20, requiredReadableFields: ['secret']);
    }

    private function query(string $scope, ActorContext $actor, array $filter, array $sort, bool $manager = false, bool $grant = false, string $rowScope = 'public', array $recordIds = []): MagicBaseRowQuery
    {
        $column = new MagicBaseColumnEntity(['id' => 10, 'column_key' => 'secret', 'data_type' => 'text', 'dynamic_permission' => ['read_scope' => $scope]]);
        $permissions = $grant ? [new MagicBaseColumnPermissionEntity(['subject_type' => 'user', 'subject_id' => 'reader', 'can_read' => true])] : [];
        $access = new MagicBaseAccessContext(new MagicBaseColumnIndex(['secret' => $column]), new MagicBaseEntityCollection(), new MagicBaseEntityCollection(), new MagicBaseEntityCollection(), new MagicBasePermissionIndex([10 => new MagicBaseEntityCollection($permissions)]), new MagicBasePermissionIndex([]), $manager);
        $table = new MagicBaseTableEntity(['id' => 12, 'project_id' => 11, 'dynamic_permissions' => ['row' => ['read_scope' => $rowScope]]]);
        return (new MagicBaseRowQueryCriteriaDomainService(new MagicBaseRowFilterDomainService()))->buildReadableQuery('org', $table, $access, $actor, $filter, $sort, 1, 20, false, $recordIds);
    }

    private function compile(MagicBaseRowQuery $query): array
    {
        $reflection = new ReflectionClass(MagicBaseMongoRowQueryRepository::class);
        $repository = $reflection->newInstanceWithoutConstructor();
        $reflection->getProperty('queryCompiler')->setValue($repository, new MagicBaseMongoQueryCompiler());
        return $reflection->getMethod('buildFilter')->invoke($repository, $query);
    }

    private function baseFilter(): array
    {
        return ['data_organization_code' => 'org', 'project_id' => 11, 'table_id' => 12, 'deleted' => false];
    }
}
