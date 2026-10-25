<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Common\Transfer;

use App\Application\SuperMagic\Common\Collaboration\Policy\ResourceAccessPolicyService;
use App\Application\SuperMagic\Common\Transfer\ResourceTransferAppService;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\UserStatus;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Group\Repository\Facade\MagicGroupRepositoryInterface;
use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationRepositoryInterface;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ResourceVisibilityEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Repository\Facade\OperationPermissionRepositoryInterface;
use App\Domain\Permission\Repository\Facade\ResourceVisibilityRepositoryInterface;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Domain\SuperMagic\Agent\Entity\SuperMagicAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\UserAgentEntity;
use App\Domain\SuperMagic\Agent\Event\AgentMarketUpdatedEvent;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\TransferResult;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\UserSkillEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillSourceType;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Infrastructure\Core\DataIsolation\BaseOrganizationInfoManager;
use App\Infrastructure\Core\DataIsolation\BaseSubscriptionManager;
use App\Infrastructure\Core\DataIsolation\BaseThirdPlatformDataIsolationManager;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\DTO\Request\TransferResourceRequestDTO;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Database\ConnectionInterface;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\Model\Model;
use Hyperf\DbConnection\Db;
use Hyperf\Snowflake\IdGeneratorInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use RuntimeException;

/** @internal Tests use a fake connection and never touch a real database. */
class ResourceTransferAppServiceTest extends TestCase
{
    private array $dependencies;

    private $organizationRepository;

    private $permissionRepository;

    private array $savedPermissions = [];

    private array $inheritedPermissions = [];

    private array $visibilityGrants = [];

    private $visibilityRepository;

    private ?ContainerInterface $previousContainer;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $this->dependencies = [];
        foreach ((new ReflectionClass(ResourceTransferAppService::class))->getConstructor()->getParameters() as $parameter) {
            if ($parameter->getName() === 'organizations') {
                $this->organizationRepository = $this->createMock(OrganizationRepositoryInterface::class);
                $this->dependencies['organizations'] = new OrganizationDomainService(
                    $this->organizationRepository,
                    $this->createMock(MagicUserDomainService::class),
                    $this->createMock(OrganizationAdminDomainService::class),
                );
            } elseif ($parameter->getName() === 'permissions') {
                $this->permissionRepository = $this->createMock(OperationPermissionRepositoryInterface::class);
                $this->permissionRepository->method('save')->willReturnCallback(function ($isolation, $entity) {
                    $this->savedPermissions[] = [$entity->getTargetId(), $entity->getOperation()];
                    return $entity;
                });
                $this->permissionRepository->method('listByTargetIds')->willReturnCallback(function () {
                    $grants = $this->inheritedPermissions;
                    $direct = [];
                    foreach ($this->savedPermissions as [$id, $operation]) {
                        $grant = new OperationPermissionEntity();
                        $grant->setTargetId($id);
                        $grant->setTargetType(TargetType::UserId);
                        $grant->setResourceId('skill');
                        $grant->setOperation($operation);
                        $direct[$id] = $grant;
                    }
                    return array_merge($grants, array_values($direct));
                });
                $groups = $this->createMock(MagicGroupRepositoryInterface::class);
                $groups->method('getGroupIdsByUserIds')->willReturn(['sender' => ['group']]);
                $departments = $this->createMock(MagicDepartmentUserRepositoryInterface::class);
                $departments->method('getDepartmentIdsByUserIds')->willReturn(['sender' => ['department']]);
                $this->dependencies['permissions'] = new OperationPermissionDomainService(
                    $this->permissionRepository,
                    $groups,
                    $departments,
                );
            } else {
                $this->dependencies[$parameter->getName()] = $this->createMock($parameter->getType()->getName());
            }
        }
        $this->visibilityGrants = ['sender' => PrincipalType::USER, 'other' => PrincipalType::USER];
        $this->visibilityRepository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $this->visibilityRepository->method('deleteByResourceAndPrincipals')->willReturnCallback(function ($isolation, $type, $code, $principalType, $ids) {
            foreach ($ids as $id) {
                if (($this->visibilityGrants[$id] ?? null) === $principalType) {
                    unset($this->visibilityGrants[$id]);
                }
            }
            return count($ids);
        });
        $this->visibilityRepository->method('listByPrincipalIds')->willReturnCallback(function ($isolation, $principalIds) {
            $entities = [];
            foreach ($this->visibilityGrants as $id => $type) {
                if (in_array($id, $principalIds, true)) {
                    $entity = new ResourceVisibilityEntity();
                    $entity->setResourceCode('skill');
                    $entities[] = $entity;
                }
            }
            return $entities;
        });
        $this->dependencies['policy'] = new ResourceAccessPolicyService(
            $this->dependencies['permissions'],
            new ResourceVisibilityDomainService($this->visibilityRepository, $departments)
        );
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(static fn ($key) => $key);
        $connection = $this->createMock(ConnectionInterface::class);
        $connection->method('transaction')->willReturnCallback(static fn ($callback) => $callback());
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($connection);
        $config = new Config(['app_env' => 'testing', 'error_message' => require BASE_PATH . '/config/autoload/error_message.php']);
        $agentDomain = $this->createMock(AgentDomainService::class);
        $idGenerator = $this->createMock(IdGeneratorInterface::class);
        $idGenerator->method('generate')->willReturn(123);
        ApplicationContext::setContainer(new class($config, $translator, $resolver, $agentDomain, $idGenerator) implements ContainerInterface {
            public function __construct(private $config, private $translator, private $resolver, private $agentDomain, private $idGenerator)
            {
            }

            public function get(string $id): mixed
            {
                return match ($id) {
                    AgentDomainService::class => $this->agentDomain,
                    IdGeneratorInterface::class => $this->idGenerator,
                    ConfigInterface::class => $this->config,
                    TranslatorInterface::class => $this->translator,
                    ConnectionResolverInterface::class => $this->resolver,
                    Db::class => new Db($this),
                    ThirdPlatformDataIsolationManagerInterface::class => new BaseThirdPlatformDataIsolationManager(),
                    SubscriptionManagerInterface::class => new BaseSubscriptionManager(),
                    OrganizationInfoManagerInterface::class => new BaseOrganizationInfoManager(),
                    default => throw new RuntimeException('Unexpected dependency: ' . $id),
                };
            }

            public function make(string $id, array $parameters = []): mixed
            {
                return $this->get($id);
            }

            public function has(string $id): bool
            {
                return true;
            }
        });
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer) {
            ApplicationContext::setContainer($this->previousContainer);
        }
    }

    public function testRequestIgnoresRoleWhenSharingIsDisabled(): void
    {
        $request = new TransferResourceRequestDTO(['receiver_id' => 'receiver', 'share_to_me' => false, 'share_role' => ['ignored']]);
        self::assertFalse($request->shareToMe);
        self::assertSame('manage', $request->shareRole);
        self::assertSame('manage', (new TransferResourceRequestDTO(['share_to_me' => true]))->shareRole);
    }

    public function testPersonalOrganizationDoesNotReachAnyWrites(): void
    {
        $organization = $this->createMock(OrganizationEntity::class);
        $organization->method('isPersonal')->willReturn(true);
        $this->organizationRepository->method('getByCode')->willReturn($organization);
        $this->dependencies['repository']->expects($this->never())->method('lock');
        $this->expectException(BusinessException::class);
        $this->transfer(false, 'viewer');
    }

    public function testCrossOrganizationReceiverDoesNotReachAnyWrites(): void
    {
        $this->allowOrganization('another-org');
        $this->dependencies['repository']->expects($this->never())->method('lock');
        $this->expectException(BusinessException::class);
        $this->transfer(false, 'viewer');
    }

    public function testStaleOwnerCannotTransferAgain(): void
    {
        $this->allowOrganization();
        $this->dependencies['repository']->method('lock')->willReturn($this->model(['creator_id' => 'new-owner']));
        $this->dependencies['repository']->expects($this->never())->method('changeOwner');
        $this->expectException(BusinessException::class);
        $this->transfer(false, 'viewer');
    }

    public function testWithoutSharingRemovesSenderAccessAndIgnoresRole(): void
    {
        $this->prepareResource();
        $this->permissionRepository->expects($this->once())->method('beachDelete');
        $result = $this->transfer(false, 'viewer');
        self::assertNull($result['user_role']);
        self::assertArrayNotHasKey('sender', $this->visibilityGrants);
        self::assertArrayHasKey('other', $this->visibilityGrants);
        self::assertSame('receiver', $result['owner_id']);
    }

    public function testDisablingSharingPreservesInheritedDepartmentAndGroupGrants(): void
    {
        $this->prepareResource();
        foreach ([TargetType::DepartmentId, TargetType::GroupId] as $targetType) {
            $grant = new OperationPermissionEntity();
            $grant->setTargetType($targetType);
            $grant->setTargetId($targetType === TargetType::DepartmentId ? 'department' : 'group');
            $grant->setResourceId('skill');
            $grant->setOperation(Operation::Edit);
            $this->inheritedPermissions[] = $grant;
        }
        $this->permissionRepository->expects($this->once())->method('beachDelete')->with(
            $this->anything(),
            $this->callback(static fn ($grants) => count($grants) === 1 && $grants[0]->getTargetId() === 'sender')
        );
        self::assertSame('editor', $this->transfer(false, 'viewer')['user_role']);
        foreach ($this->inheritedPermissions as $grant) {
            self::assertSame(Operation::Edit, $grant->getOperation());
        }
    }

    public function testDepartmentVisibilityStillGrantsReadAfterRemovingPersonalSharing(): void
    {
        $this->prepareResource();
        $this->visibilityGrants['department'] = PrincipalType::DEPARTMENT;
        self::assertSame('viewer', $this->transfer(false, 'manage')['user_role']);
        self::assertSame(PrincipalType::DEPARTMENT, $this->visibilityGrants['department']);
        self::assertArrayNotHasKey('sender', $this->visibilityGrants);
    }

    public function testSkillReceiverMarketInstallationBecomesLiveOwnership(): void
    {
        $this->prepareResource();
        $ownership = new UserSkillEntity(['id' => 456, 'source_type' => 'MARKET', 'source_id' => 123, 'skill_version_id' => 789]);
        $this->dependencies['skillOwnerships']->method('findUserSkillOwnershipByCode')->willReturn($ownership);
        $this->dependencies['skillOwnerships']->expects($this->once())->method('saveUserSkillOwnership')->with(
            $this->anything(),
            $this->callback(static fn ($record) => $record->getId() === 456 && $record->getUserId() === 'receiver'
                && $record->getSourceType() === SkillSourceType::LOCAL_UPLOAD
                && $record->getSkillVersionId() === null && $record->getSourceId() === null)
        )->willReturn($ownership);
        $this->dependencies['skillOwnerships']->expects($this->once())->method('deleteUserSkillOwnership');
        $this->transfer(false, 'manage');
    }

    #[DataProvider('sharingRoles')]
    public function testSharingKeepsTheChosenRole(string $role, Operation $operation): void
    {
        $this->prepareResource();
        self::assertSame($role, $this->transfer(true, $role)['user_role']);
        self::assertContains(['sender', $operation], $this->savedPermissions);
    }

    public static function sharingRoles(): array
    {
        return [['manage', Operation::Admin], ['editor', Operation::Edit], ['viewer', Operation::Read]];
    }

    public function testBoundProjectAndMembershipTransferTogether(): void
    {
        $this->prepareResource(42);
        $this->dependencies['repository']->method('lockProject')->with(42)->willReturn($this->model(['user_id' => 'sender', 'user_organization_code' => 'org', 'project_name' => 'Editing project']));
        $project = new ProjectEntity();
        $project->setId(42);
        $project->setWorkspaceId(84);
        $this->dependencies['projects']->method('transferProject')->willReturn(TransferResult::successProject($project, 0));
        $this->dependencies['members']->method('batchGetMembersByProjectsAndUser')->willReturn([]);
        $this->dependencies['members']->method('getProjectIdsWithEffectiveCollaborators')->willReturn([42]);
        $this->dependencies['projectDomain']->expects($this->once())->method('batchEnableCollaboration')->with([42]);
        $this->dependencies['members']->expects($this->once())->method('batchHandleReceiverMembership')->with([42], 'receiver', 'sender', 'org', []);
        $this->dependencies['members']->expects($this->once())->method('batchHandleOriginalOwnerMembership')->with([42], 'sender', 'org', true, 'editor');
        self::assertSame('editor', $this->transfer(true, 'editor')['user_role']);
    }

    public function testAuditFailureDoesNotEmitSuccessEvents(): void
    {
        $this->prepareResource();
        $this->dependencies['logs']->method('saveLog')->willThrowException(new RuntimeException('Audit failed'));
        $this->dependencies['events']->expects($this->never())->method('dispatch');
        $this->expectExceptionMessage('Audit failed');
        $this->transfer(false, 'manage');
    }

    public function testAgentTransferChangesItsOwnershipWithoutTransferringSkills(): void
    {
        $this->prepareResource();
        $this->dependencies['agents']->method('getResource')->willReturn($this->createMock(SuperMagicAgentEntity::class));
        $this->dependencies['repository']->expects($this->once())->method('changeOwner')
            ->with($this->anything(), true, 'receiver');
        $this->dependencies['skills']->expects($this->never())->method('getResource');
        $this->dependencies['skillOwnerships']->expects($this->never())->method('saveUserSkillOwnership');
        $this->dependencies['skillOwnerships']->expects($this->never())->method('deleteUserSkillOwnership');
        self::assertSame('receiver', $this->transfer(false, 'manage', true)['owner_id']);
    }

    public function testAgentMarketResponsibilityAndIndexFollowNewOwner(): void
    {
        $this->prepareResource();
        $this->dependencies['agents']->method('getResource')->willReturn($this->createMock(SuperMagicAgentEntity::class));
        $this->dependencies['repository']->expects($this->once())->method('transferOrganizationMarketOwner')
            ->with('org', 'skill', 'receiver')->willReturn([7]);
        $events = [];
        $this->dependencies['events']->expects($this->exactly(2))->method('dispatch')->willReturnCallback(function ($event) use (&$events) {
            $events[] = $event;
            return $event;
        });
        $this->transfer(false, 'manage', true);
        self::assertInstanceOf(AgentMarketUpdatedEvent::class, $events[1]);
        self::assertSame('7', $events[1]->agentMarketId);
        self::assertArrayNotHasKey('sender', $this->visibilityGrants);
    }

    public function testAgentReceiverOwnershipIsMergedInsteadOfDuplicated(): void
    {
        $this->prepareResource();
        $this->dependencies['agents']->method('getResource')->willReturn($this->createMock(SuperMagicAgentEntity::class));
        $ownership = new UserAgentEntity();
        $ownership->setId(987);
        $this->dependencies['ownerships']->method('findUserAgentOwnershipByCode')->willReturn($ownership);
        $this->dependencies['ownerships']->expects($this->once())->method('saveUserAgentOwnership')->with($this->anything(), $this->callback(static fn ($record) => $record->getId() === 987 && $record->getUserId() === 'receiver'))->willReturn($ownership);
        $this->dependencies['ownerships']->expects($this->once())->method('deleteUserAgentOwnership');
        $this->transfer(false, 'manage', true);
    }

    private function allowOrganization(string $receiverOrg = 'org'): void
    {
        $organization = $this->createMock(OrganizationEntity::class);
        $organization->method('isPersonal')->willReturn(false);
        $this->organizationRepository->method('getByCode')->willReturn($organization);
        $this->dependencies['packages']->method('canTransferProject')->willReturn(true);
        $receiver = $this->createMock(MagicUserEntity::class);
        $receiver->method('getOrganizationCode')->willReturn($receiverOrg);
        $receiver->method('getStatus')->willReturn(UserStatus::Activated);
        $this->dependencies['users']->method('getByUserId')->willReturn($receiver);
    }

    private function prepareResource(int $projectId = 0): void
    {
        $this->allowOrganization();
        $resource = $this->model(['id' => 123, 'creator' => 'sender', 'creator_id' => 'sender', 'source_type' => 'LOCAL_UPLOAD']);
        $this->dependencies['repository']->method('lock')->willReturn($resource);
        $owner = new OperationPermissionEntity();
        $owner->setTargetId('sender');
        $owner->setOperation(Operation::Owner);
        $this->permissionRepository->method('getResourceOwner')->willReturn($owner);
        $context = $this->createMock(SkillEntity::class);
        $context->method('getProjectId')->willReturn($projectId);
        $this->dependencies['skills']->method('getResource')->willReturn($context);
        $this->dependencies['skills']->method('getProjectId')->willReturn($projectId);
        $this->dependencies['events']->method('dispatch')->willReturnArgument(0);
    }

    private function model(array $attributes): Model
    {
        $model = $this->createMock(Model::class);
        $model->method('getAttribute')->willReturnCallback(static fn ($key) => $attributes[$key] ?? null);
        return $model;
    }

    private function transfer(bool $share, string $role, bool $isAgent = false): array
    {
        $request = new TransferResourceRequestDTO();
        $request->receiverId = 'receiver';
        $request->shareToMe = $share;
        $request->shareRole = $role;
        $authorization = (new MagicUserAuthorization())->setId('sender')->setOrganizationCode('org');
        return (new ResourceTransferAppService(...$this->dependencies))->transfer($authorization, 'skill', $isAgent, $request);
    }
}
