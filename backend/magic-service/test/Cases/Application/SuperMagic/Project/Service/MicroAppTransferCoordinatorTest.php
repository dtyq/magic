<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Project\Service;

use App\Application\SuperMagic\Project\Service\TransferAppService;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\UserStatus;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationRepositoryInterface;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectMemberEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Project\Entity\ValueObject\TransferResult;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Project\DTO\Request\TransferProjectsRequestDTO;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Database\ConnectionInterface;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\DbConnection\Db;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use ReflectionClass;
use ReflectionProperty;
use RuntimeException;

/** @internal Tests common orchestration reused by micro-app transfer with a fake DB. */
final class MicroAppTransferCoordinatorTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    private array $dependencies;

    private $connection;

    private $organizations;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $this->dependencies = [];
        foreach ((new ReflectionClass(TransferAppService::class))->getConstructor()->getParameters() as $parameter) {
            if ($parameter->getName() === 'organizationDomainService') {
                $this->organizations = $this->createMock(OrganizationRepositoryInterface::class);
                $dependency = new OrganizationDomainService(
                    $this->organizations,
                    $this->createMock(MagicUserDomainService::class),
                    $this->createMock(OrganizationAdminDomainService::class)
                );
            } else {
                $dependency = $this->createMock($parameter->getType()->getName());
            }
            $this->dependencies[$parameter->getName()] = $dependency;
        }
        $this->connection = $this->createMock(ConnectionInterface::class);
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($this->connection);
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(static fn ($key) => $key);
        $config = new Config(['error_message' => require BASE_PATH . '/config/autoload/error_message.php']);
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(static fn ($id) => match ($id) {
            ConfigInterface::class => $config, TranslatorInterface::class => $translator,
            ConnectionResolverInterface::class => $resolver,
            Db::class => new Db($container),
            default => throw new RuntimeException($id),
        });
        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        } else {
            (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, null);
        }
    }

    /** @dataProvider shareRoles */
    public function testTransferKeepsCommonMembersSchedulesAuditAndSuccessOnEventFailure(bool $share, string $role): void
    {
        $this->organizations->method('getByCode')->willReturn(new OrganizationEntity());
        $this->dependencies['packageFilterService']->method('canTransferProject')->willReturn(true);
        $this->dependencies['magicUserDomainService']->method('getByUserId')->willReturnCallback(static fn ($id) => new MagicUserEntity([
            'nickname' => 'Name', 'user_id' => $id, 'organization_code' => 'org', 'status' => UserStatus::Activated->value,
        ]));
        $project = new ProjectEntity(['id' => 10, 'project_name' => 'App', 'workspace_id' => 99]);
        $this->dependencies['transferDomainService']->method('generateBatchId')->willReturn('batch');
        $this->dependencies['transferDomainService']->method('transferProject')->willReturn(TransferResult::successProject($project, 0));
        $this->connection->expects(self::once())->method('beginTransaction');
        $this->connection->expects(self::once())->method('commit');
        $this->connection->expects(self::never())->method('rollBack');
        $members = $this->dependencies['projectMemberDomainService'];
        $existing = new ProjectMemberEntity(['role' => MemberRole::VIEWER->value]);
        $members->method('batchGetMembersByProjectsAndUser')->willReturn([10 => $existing]);
        $members->expects(self::once())->method('batchHandleReceiverMembership')->with([10], 'receiver', 'sender', 'org', [10 => $existing]);
        $members->expects(self::once())->method('batchHandleOriginalOwnerMembership')->with([10], 'sender', 'org', $share, $share ? $role : '', 0);
        $members->expects(self::never())->method('deleteByProjectId');
        $members->method('getProjectIdsWithEffectiveCollaborators')->willReturn([10]);
        $this->dependencies['projectDomainService']->expects(self::once())->method('batchEnableCollaboration')->with([10]);
        $this->dependencies['messageScheduleDomainService']->expects(self::once())->method('syncTransferredProjectSchedules')
            ->with([10], 'sender', 'receiver', 'org', 99, 'sender');
        $this->dependencies['transferLogDomainService']->expects(self::once())->method('saveLog');
        $this->dependencies['operationLogDomainService']->expects(self::once())->method('saveOperationLog');
        $this->dependencies['eventDispatcher']->method('dispatch')->willThrowException(new RuntimeException('queue unavailable'));
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())->method('error');
        $this->dependencies['loggerFactory']->method('get')->willReturn($logger);
        $result = $this->service()->transferProjects($this->context(), new TransferProjectsRequestDTO([
            'project_ids' => ['10'], 'receiver_id' => 'receiver', 'share_to_me' => $share, 'share_role' => $role,
        ]));
        self::assertSame(1, $result['success_count']);
        self::assertSame(0, $result['failed_count']);
    }

    public static function shareRoles(): array
    {
        return [[false, 'viewer'], [true, 'manage'], [true, 'editor'], [true, 'viewer']];
    }

    /** @dataProvider unavailableReceivers */
    public function testInvalidReceiverOrPersonalOrganizationCannotWrite(string $receiver, string $receiverOrg, int $status, bool $personal): void
    {
        $this->organizations->method('getByCode')->willReturn(new OrganizationEntity(['type' => $personal ? 1 : 0]));
        $this->dependencies['packageFilterService']->method('canTransferProject')->willReturn(true);
        $this->dependencies['magicUserDomainService']->method('getByUserId')->willReturn(new MagicUserEntity([
            'nickname' => 'Name', 'organization_code' => $receiverOrg, 'status' => $status,
        ]));
        $this->connection->expects(self::never())->method('beginTransaction');
        $this->dependencies['transferDomainService']->expects(self::never())->method('transferProject');
        $this->expectException(BusinessException::class);
        $this->service()->transferProjects($this->context(), new TransferProjectsRequestDTO(['project_ids' => ['10'], 'receiver_id' => $receiver]));
    }

    public static function unavailableReceivers(): array
    {
        return [['sender', 'org', 1, false], ['receiver', 'other', 1, false], ['receiver', 'org', 0, false], ['receiver', 'org', 2, false], ['receiver', 'org', 1, true]];
    }

    private function service(): TransferAppService
    {
        return new TransferAppService(...array_values($this->dependencies));
    }

    private function context(): RequestContext
    {
        $context = $this->createMock(RequestContext::class);
        $context->method('getUserAuthorization')->willReturn((new MagicUserAuthorization())->setId('sender')->setOrganizationCode('org'));
        return $context;
    }
}
