<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Project\Service;

use App\Domain\SuperMagic\Common\Entity\ValueObject\HiddenType;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Entity\ValueObject\TransferOptions;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Persistence\MicroAppTransferRepository;
use App\Domain\SuperMagic\Project\Service\MicroApp\MicroAppTransferDomainService;
use App\Domain\SuperMagic\Project\Service\TransferDomainService;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Workspace\Entity\ValueObject\WorkspaceType;
use App\Domain\SuperMagic\Workspace\Entity\WorkspaceEntity;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceRepositoryInterface;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\Infrastructure\Core\DataIsolation\BaseOrganizationInfoManager;
use App\Infrastructure\Core\DataIsolation\BaseSubscriptionManager;
use App\Infrastructure\Core\DataIsolation\BaseThirdPlatformDataIsolationManager;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionProperty;
use RuntimeException;

/** @internal Isolated tests: no real database or application bootstrap. */
final class MicroAppTransferDomainServiceTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $agentDomain = $this->createMock(AgentDomainService::class);
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(static fn ($id) => match ($id) {
            AgentDomainService::class => $agentDomain,
            ConfigInterface::class => new Config(['app_env' => 'testing']),
            ThirdPlatformDataIsolationManagerInterface::class => new BaseThirdPlatformDataIsolationManager(),
            SubscriptionManagerInterface::class => new BaseSubscriptionManager(),
            OrganizationInfoManagerInterface::class => new BaseOrganizationInfoManager(),
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

    /** @dataProvider recognizedApps */
    public function testCommonProjectTransferUsesReceiverMicroAppWorkspace(string $mode, string $workspaceType, bool $hasApp): void
    {
        $project = new ProjectEntity([
            'id' => 10, 'user_id' => 'sender', 'user_organization_code' => 'org', 'workspace_id' => 20,
            'project_mode' => $mode, 'created_uid' => 'historical-author', 'project_name' => 'App',
        ]);
        $app = new MicroAppEntity(['id' => 30, 'project_id' => 10, 'organization_code' => 'org', 'creator_id' => 'historical-author']);
        $repository = $this->createMock(MicroAppTransferRepository::class);
        $order = [];
        $repository->expects(self::once())->method('lockProject')->with(10)->willReturnCallback(static function () use ($project, &$order) {
            $order[] = 'project';
            return $project;
        });
        $repository->expects(self::once())->method('lockAppByProject')->with(10, 'org')->willReturnCallback(static function () use ($app, $hasApp, &$order) {
            self::assertSame(['project'], $order);
            return $hasApp ? $app : null;
        });
        $repository->expects($hasApp ? self::once() : self::never())->method('changeAppOwner')->with($app, 'receiver');
        $projects = $this->createMock(ProjectRepositoryInterface::class);
        $projects->expects(self::never())->method('save');
        $repository->expects(self::once())->method('changeProjectOwner')->with($project);
        $workspaces = $this->createMock(WorkspaceRepositoryInterface::class);
        $workspaces->method('findById')->willReturn(new WorkspaceEntity(['workspace_type' => $workspaceType]));
        $workspaces->expects(self::never())->method('findByUserAndName');
        $workspaceDomain = $this->createMock(WorkspaceDomainService::class);
        $workspaceDomain->expects(self::once())->method('getOrCreateWorkspaceByType')
            ->with(self::callback(static fn ($identity) => $identity->getCurrentUserId() === 'receiver'
                && $identity->getCurrentOrganizationCode() === 'org'), WorkspaceType::MicroApp)
            ->willReturn(new WorkspaceEntity(['id' => 99]));
        $domain = new MicroAppTransferDomainService($repository, $workspaces, $workspaceDomain);
        $result = (new TransferDomainService($workspaces, $projects, $domain))->transferProject(
            10,
            'sender',
            'receiver',
            'org',
            TransferOptions::forProject('Sender', 'From', true, 'viewer', true)
        );
        self::assertTrue($result->isSuccess());
        self::assertSame('receiver', $result->getProject()->getUserId());
        self::assertSame(99, $result->getProject()->getWorkspaceId());
        self::assertSame('historical-author', $result->getProject()->getCreatedUid());
        self::assertSame('historical-author', $app->getCreatorId());
        self::assertNull($result->getOriginalWorkspaceIdForProject());
    }

    public static function recognizedApps(): array
    {
        return [[ProjectMode::MICRO_APP->value, 'default', true], ['general', 'default', true], ['general', WorkspaceType::MicroApp->value, false]];
    }

    /** @dataProvider rejectedProjects */
    public function testStaleOwnerCrossOrganizationAndRuntimeNeverWrite(string $owner, string $org, ?int $hiddenType): void
    {
        $repository = $this->createMock(MicroAppTransferRepository::class);
        $repository->method('lockProject')->willReturn(new ProjectEntity([
            'id' => 10, 'user_id' => $owner, 'user_organization_code' => $org, 'hidden_type' => $hiddenType,
        ]));
        $repository->expects(self::never())->method('changeAppOwner');
        $repository->expects(self::never())->method('changeProjectOwner');
        $domain = new MicroAppTransferDomainService(
            $repository,
            $this->createMock(WorkspaceRepositoryInterface::class),
            $this->createMock(WorkspaceDomainService::class)
        );
        self::assertFalse($domain->transferIfMicroApp(10, 'sender', 'receiver', 'org')->isSuccess());
    }

    public static function rejectedProjects(): array
    {
        return [['already-transferred', 'org', null], ['sender', 'other-org', null], ['sender', 'org', HiddenType::MICRO_APP_RUNTIME->value]];
    }

    public function testOrdinaryProjectFallsBackWithoutMicroAppWrites(): void
    {
        $repository = $this->createMock(MicroAppTransferRepository::class);
        $repository->method('lockProject')->willReturn(new ProjectEntity(['user_id' => 'sender', 'user_organization_code' => 'org']));
        $repository->expects(self::never())->method('changeAppOwner');
        $domain = new MicroAppTransferDomainService(
            $repository,
            $this->createMock(WorkspaceRepositoryInterface::class),
            $this->createMock(WorkspaceDomainService::class)
        );
        self::assertNull($domain->transferIfMicroApp(10, 'sender', 'receiver', 'org'));
    }

    /** @dataProvider protectedWorkspaces */
    public function testSystemWorkspaceCannotBypassAppTransfer(string $type, bool $containsApps): void
    {
        $workspaces = $this->createMock(WorkspaceRepositoryInterface::class);
        $workspaces->method('findById')->willReturn(new WorkspaceEntity(['workspace_type' => $type]));
        $projects = $this->createMock(ProjectRepositoryInterface::class);
        $projects->expects(self::never())->method('batchUpdateOwner');
        $helper = new MicroAppTransferDomainService(
            $this->createMock(MicroAppTransferRepository::class),
            $workspaces,
            $this->createMock(WorkspaceDomainService::class)
        );
        $result = (new TransferDomainService($workspaces, $projects, $helper))->transferWorkspace(
            20,
            'sender',
            'receiver',
            'org',
            TransferOptions::forWorkspace('Sender', 'From')
        );
        self::assertFalse($result->isSuccess());
    }

    public static function protectedWorkspaces(): array
    {
        return [[WorkspaceType::MicroApp->value, false], [WorkspaceType::Default->value, true]];
    }
}
