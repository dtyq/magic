<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\MagicBase\Support;

use App\Application\MagicBase\Support\MagicBaseAccessControl;
use App\Application\MagicBase\Support\MagicBaseRuntimeProjectAccessContext;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\MagicBase\Entity\MagicBaseRowEntity;
use App\Domain\MagicBase\Entity\MagicBaseTableEntity;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseConst;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseEntityCollection;
use App\Domain\MagicBase\Repository\Facade\MagicBaseMigrationLogRepositoryInterface;
use App\Domain\MagicBase\Repository\Facade\MagicBasePermissionRepositoryInterface;
use App\Domain\MagicBase\Repository\Facade\MagicBaseRelationRepositoryInterface;
use App\Domain\MagicBase\Repository\Facade\MagicBaseTableRepositoryInterface;
use App\Domain\MagicBase\Service\MagicBaseMetadataDomainService;
use App\Domain\MagicBase\Service\MagicBasePermissionDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowStorageResolverDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectMemberEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\ErrorCode\MagicBaseErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;

/** @internal */
class MagicBaseAccessControlTest extends TestCase
{
    private MagicBaseAccessControl $access;

    private PublishedMicroAppFileAccessService $publication;

    private MagicBaseTableRepositoryInterface $tables;

    private ProjectMemberDomainService $members;

    private ProjectEntity $project;

    private ?ContainerInterface $previousContainer = null;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static fn ($key, $default = null) => match ($key) {
            'error_message' => ['error_code_mapper' => [MagicBaseErrorCode::class => [48000, 48999]]],
            'app_env' => 'testing',
            default => $default,
        });
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnArgument(0);
        $agent = $this->createMock(AgentDomainService::class);
        $agent->method('getAuthorizationByUserId')->willReturn('test-token');
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnMap([[ConfigInterface::class, $config], [TranslatorInterface::class, $translator], [AgentDomainService::class, $agent]]);
        ApplicationContext::setContainer($container);
        Context::set('magicbase.share_access_project_ids', []);
        Context::set('magicbase.share_access_actors', []);

        $this->project = (new ProjectEntity())->setId(11)->setUserId('owner')->setCreatedUid('owner')->setUserOrganizationCode('org');
        $projects = $this->createMock(ProjectDomainService::class);
        $projects->method('getProjectsByIds')->with([11])->willReturn([$this->project]);
        $this->members = $this->createMock(ProjectMemberDomainService::class);
        $departments = new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class));
        $this->publication = $this->createMock(PublishedMicroAppFileAccessService::class);
        $this->tables = $this->createMock(MagicBaseTableRepositoryInterface::class);
        $metadata = new MagicBaseMetadataDomainService(
            $this->tables,
            $this->createMock(MagicBaseRelationRepositoryInterface::class),
            $this->createMock(MagicBasePermissionRepositoryInterface::class),
            $this->createMock(MagicBaseMigrationLogRepositoryInterface::class),
        );
        $this->access = new MagicBaseAccessControl(
            $metadata,
            new MagicBasePermissionDomainService(),
            (new ReflectionClass(MagicBaseRowStorageResolverDomainService::class))->newInstanceWithoutConstructor(),
            $projects,
            $this->members,
            $departments,
            $this->createMock(MicroAppRepositoryInterface::class),
            $this->publication,
        );
    }

    protected function tearDown(): void
    {
        (new ReflectionClass(ApplicationContext::class))->getProperty('container')->setValue(null, $this->previousContainer);
        Context::destroy('magicbase.share_access_project_ids');
        Context::destroy('magicbase.share_access_actors');
    }

    public function testPublicationAllowsReadingWithoutMembershipAndRechecksRevocation(): void
    {
        $this->publication->expects(self::exactly(2))->method('canAccessProject')->with(11, 'reader', 'org')->willReturnOnConsecutiveCalls(true, false);
        $this->access->requireReadableProject($this->reader(), 11);
        self::assertFalse($this->access->isProjectDataAdmin($this->reader(), 11));
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->access->requireReadableProject($this->reader(), 11);
    }

    #[DataProvider('writeOperations')]
    public function testPublicationDoesNotGrantWriteOrManagement(string $method): void
    {
        $this->publication->expects(self::never())->method('canAccessProject');
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->access->{$method}($this->reader(), 11);
    }

    public static function writeOperations(): array
    {
        return [['requireWritableProject'], ['requireManageableProject']];
    }

    public function testOtherOrganizationIsRejectedBeforePublicationLookup(): void
    {
        $this->publication->expects(self::never())->method('canAccessProject');
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->access->requireReadableProject($this->reader()->setOrganizationCode('other'), 11);
    }

    public function testExistingOwnerAndEditorPermissionsDoNotNeedPublication(): void
    {
        $this->publication->expects(self::never())->method('canAccessProject');
        $this->access->requireManageableProject($this->reader()->setId('owner'), 11);
        $member = new ProjectMemberEntity();
        $member->setRole(MemberRole::EDITOR);
        $this->members->method('getMemberByProjectAndUser')->willReturn($member);
        $this->access->requireReadableProject($this->reader(), 11);
        $this->access->requireWritableProject($this->reader(), 11);
        self::assertTrue($this->access->isProjectDataAdmin($this->reader(), 11));
    }

    public function testViewerCanReadButCannotWriteWithoutPublication(): void
    {
        $this->publication->expects(self::never())->method('canAccessProject');
        $member = new ProjectMemberEntity();
        $member->setRole(MemberRole::VIEWER);
        $this->members->method('getMemberByProjectAndUser')->willReturn($member);
        $this->access->requireReadableProject($this->reader(), 11);
        self::assertFalse($this->access->isProjectDataAdmin($this->reader(), 11));
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->access->requireWritableProject($this->reader(), 11);
    }

    public function testPublishedReaderKeepsRealActorAndPrivateRowFiltering(): void
    {
        $this->publication->method('canAccessProject')->willReturn(true);
        $table = new MagicBaseTableEntity();
        $table->setDynamicPermissions(['row' => ['read_scope' => MagicBaseConst::SCOPE_PRIVATE_USER]]);
        $this->tables->method('getTable')->with('org', 11, 22)->willReturn($table);
        $context = $this->access->requireReadableTable($this->reader(), 11, 22);
        self::assertSame('reader', $context->getActor()->getUserId());
        self::assertFalse($context->getAccess()->isManager());
        $own = new MagicBaseRowEntity();
        $own->setCreatedBy('reader');
        $other = new MagicBaseRowEntity();
        $other->setCreatedBy('owner');
        $rows = $this->access->filterReadableRows($context, new MagicBaseEntityCollection([$own, $other]));
        self::assertSame([$own], iterator_to_array($rows));
    }

    #[DataProvider('anonymousReadScopes')]
    public function testAnonymousShareDoesNotInheritOwnerOrOrganizationRowAccess(string $scope, bool $allowed): void
    {
        MagicBaseRuntimeProjectAccessContext::allowShareAccess(11);
        $authorization = (new MagicUserAuthorization())->setId('')->setOrganizationCode('org');
        $table = new MagicBaseTableEntity();
        $table->setDynamicPermissions(['row' => ['read_scope' => $scope]]);
        $this->tables->method('getTable')->with('org', 11, 22)->willReturn($table);
        $context = $this->access->requireReadableTable($authorization, 11, 22);
        self::assertSame('', $context->getActor()->getUserId());
        self::assertSame('', $context->getActor()->getOrganizationCode());
        self::assertFalse($context->getAccess()->isManager());
        $row = new MagicBaseRowEntity(['created_by' => 'owner', 'organization_code' => 'org']);
        $rows = $this->access->filterReadableRows($context, new MagicBaseEntityCollection([$row]));
        self::assertSame($allowed ? [$row] : [], $rows->all());
    }

    public static function anonymousReadScopes(): array
    {
        return [
            [MagicBaseConst::SCOPE_PUBLIC, true],
            [MagicBaseConst::SCOPE_PRIVATE_USER, false],
            [MagicBaseConst::SCOPE_PRIVATE_ORG, false],
            [MagicBaseConst::SCOPE_PRIVATE_DEPARTMENT, false],
            [MagicBaseConst::SCOPE_DISABLED, false],
        ];
    }

    public function testAnonymousShareCannotReadADisabledTable(): void
    {
        MagicBaseRuntimeProjectAccessContext::allowShareAccess(11);
        $table = new MagicBaseTableEntity();
        $table->setDynamicPermissions(['table' => ['read_scope' => MagicBaseConst::SCOPE_DISABLED]]);
        $this->tables->method('getTable')->willReturn($table);
        $this->expectException(BusinessException::class);
        $this->access->requireReadableTable((new MagicUserAuthorization())->setId('')->setOrganizationCode('org'), 11, 22);
    }

    #[DataProvider('runtimeIdentities')]
    public function testRuntimeUserCanInsertWithoutBecomingManager(string $identity): void
    {
        $this->runtimeIdentity($identity);
        $table = new MagicBaseTableEntity();
        $table->setDynamicPermissions(['table' => ['insert_scope' => MagicBaseConst::SCOPE_PUBLIC]]);
        $this->tables->method('getTable')->willReturn($table);
        $context = $this->access->requireInsertableTable($this->reader(), 11, 22);
        self::assertSame('reader', $context->getActor()->getUserId());
        self::assertFalse($context->getAccess()->isManager());
    }

    #[DataProvider('runtimeIdentities')]
    public function testRuntimeUserCannotInsertIntoDisabledTable(string $identity): void
    {
        $this->runtimeIdentity($identity);
        $table = new MagicBaseTableEntity();
        $table->setDynamicPermissions(['table' => ['insert_scope' => MagicBaseConst::SCOPE_DISABLED]]);
        $this->tables->method('getTable')->willReturn($table);
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->access->requireInsertableTable($this->reader(), 11, 22);
    }

    #[DataProvider('runtimeIdentities')]
    public function testRuntimeUserCannotReadDisabledTable(string $identity): void
    {
        $this->runtimeIdentity($identity);
        $table = new MagicBaseTableEntity();
        $table->setDynamicPermissions(['table' => ['read_scope' => MagicBaseConst::SCOPE_DISABLED]]);
        $this->tables->method('getTable')->willReturn($table);
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->access->requireReadableTable($this->reader(), 11, 22);
    }

    public static function runtimeIdentities(): array
    {
        return [['publication'], ['share']];
    }

    public function testViewerWithoutPublicationCannotWriteData(): void
    {
        $member = new ProjectMemberEntity();
        $member->setRole(MemberRole::VIEWER);
        $this->members->method('getMemberByProjectAndUser')->willReturn($member);
        $this->publication->expects(self::once())->method('canAccessProject')->willReturn(false);
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->access->requireDataWritableTable($this->reader(), 11, 22);
    }

    public function testViewerWithPublicationCanUseDataPermissions(): void
    {
        $member = new ProjectMemberEntity();
        $member->setRole(MemberRole::VIEWER);
        $this->members->method('getMemberByProjectAndUser')->willReturn($member);
        $this->publication->method('canAccessProject')->willReturn(true);
        $this->tables->method('getTable')->willReturn(new MagicBaseTableEntity());
        self::assertFalse($this->access->requireDataWritableTable($this->reader(), 11, 22)->getAccess()->isManager());
    }

    public function testPublicationWriteAccessIsRecheckedAfterRevocation(): void
    {
        $this->publication->expects(self::exactly(2))->method('canAccessProject')->willReturnOnConsecutiveCalls(true, false);
        $this->tables->method('getTable')->willReturn(new MagicBaseTableEntity());
        $this->access->requireDataWritableTable($this->reader(), 11, 22);
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->access->requireDataWritableTable($this->reader(), 11, 22);
    }

    #[DataProvider('writeOperations')]
    public function testShareRuntimeDoesNotGrantSchemaOrManagement(string $method): void
    {
        MagicBaseRuntimeProjectAccessContext::allowShareAccess(11, 'reader', 'org');
        $this->publication->expects(self::never())->method('canAccessProject');
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->access->{$method}($this->reader(), 11);
    }

    public function testEditorRetainsDataAdministratorAccess(): void
    {
        $member = new ProjectMemberEntity();
        $member->setRole(MemberRole::EDITOR);
        $this->members->method('getMemberByProjectAndUser')->willReturn($member);
        $table = new MagicBaseTableEntity();
        $table->setDynamicPermissions(['table' => ['insert_scope' => MagicBaseConst::SCOPE_DISABLED, 'read_scope' => MagicBaseConst::SCOPE_DISABLED]]);
        $this->tables->method('getTable')->willReturn($table);
        self::assertTrue($this->access->requireInsertableTable($this->reader(), 11, 22)->getAccess()->isManager());
        self::assertTrue($this->access->requireReadableTable($this->reader(), 11, 22)->getAccess()->isManager());
    }

    public function testTableListingExcludesTablesWithoutReadPermission(): void
    {
        $this->publication->method('canAccessProject')->willReturn(true);
        $visible = new MagicBaseTableEntity();
        $visible->setId(22);
        $hidden = new MagicBaseTableEntity();
        $hidden->setId(23);
        $hidden->setDynamicPermissions(['table' => ['read_scope' => MagicBaseConst::SCOPE_DISABLED]]);
        $this->tables->expects(self::never())->method('listColumns');
        $result = $this->access->filterReadableTables($this->reader(), 11, new MagicBaseEntityCollection([$visible, $hidden]));
        self::assertSame([$visible], $result->all());
    }

    private function runtimeIdentity(string $identity): void
    {
        if ($identity === 'share') {
            MagicBaseRuntimeProjectAccessContext::allowShareAccess(11, 'reader', 'org');
        } else {
            $this->publication->method('canAccessProject')->willReturn(true);
        }
    }

    private function reader(): MagicUserAuthorization
    {
        return (new MagicUserAuthorization())->setId('reader')->setOrganizationCode('org');
    }
}
