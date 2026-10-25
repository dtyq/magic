<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Project\Service;

use App\Application\SuperMagic\Common\Collaboration\Policy\ResourceAccessPolicyService;
use App\Application\SuperMagic\File\DTO\Request\CreateAudioProjectRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\CreateAgentProjectRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\CreateMicroAppProjectRequestDTO;
use App\Application\SuperMagic\Project\Service\ProjectAppService;
use App\Application\SuperMagic\Skill\Service\SkillAppService;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicUserSettingRepositoryInterface;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\Group\Repository\Facade\MagicGroupRepositoryInterface;
use App\Domain\Permission\Repository\Facade\OperationPermissionRepositoryInterface;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Domain\SuperMagic\File\Entity\AudioProjectEntity;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\AudioProjectDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectForkEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Service\SkillDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Entity\WorkspaceEntity;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\SuperMagic\Project\DTO\Request\CreateProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\CreateSpecialProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\ForkProjectRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\CreateSkillDraftRequestDTO;
use Hyperf\Amqp\Producer;
use Hyperf\Context\ApplicationContext;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\MySqlConnection;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use HyperfTest\Cases\Application\SuperMagic\Topic\Service\CreationTransactionTestCase;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use ReflectionClass;
use RuntimeException;

/** @internal */
final class ProjectCreationTransactionTest extends CreationTransactionTestCase
{
    private ?SkillEntity $skill = null;

    public function testConversationSkillCreationUsesOneTransactionAndPreservesDefault(): void
    {
        try {
            $result = $this->skillService()->createDraft($this->requestContext(), $this->draftRequest());
        } catch (BusinessException $error) {
            self::fail('Draft creation failed before identity preparation could complete: ' . implode(', ', $this->events) . '; ' . $error->getMessage());
        }
        self::assertSame('7', $result['project_id']);
        self::assertSame('skill-code', $result['skill_code']);
        self::assertSame(7, $this->skill?->getProjectId());
        self::assertSame(1, count(array_keys($this->events, 'begin', true)));
        self::assertSame('identity', $this->events[0]);
        self::assertSame(['bind-skill', 'commit', 'event'], array_slice($this->events, -3));
        self::assertNotContains('default', $this->events);
        self::assertSame(0, $this->transactionLevel);
    }

    public function testWebSkillBindingFinalizesDefaultAfterBinding(): void
    {
        $service = $this->skillService(existingSkill: true);
        try {
            $result = $service->createAndBindProject($this->requestContext(), 'Demo', 'skill-code');
        } catch (BusinessException $error) {
            self::fail('Web binding failed before identity preparation could complete: ' . implode(', ', $this->events) . '; ' . $error->getMessage());
        }
        self::assertSame('7', $result['project']['id']);
        self::assertSame(['bind-skill', 'default', 'commit', 'event'], array_slice($this->events, -4));
        self::assertSame('identity', $this->events[0]);
    }

    public function testSkillCreationRetryReusesTheCommittedBinding(): void
    {
        $service = $this->skillService();
        $first = $service->createDraft($this->requestContext(), $this->draftRequest());
        $events = $this->events;
        $second = $service->createDraft($this->requestContext(), $this->draftRequest());
        self::assertSame($first, $second);
        self::assertSame($events, $this->events);
    }

    public function testExistingWebSkillBindingDoesNotPrepareAnotherProjectOrChangeDefault(): void
    {
        $service = $this->skillService();
        $service->createDraft($this->requestContext(), $this->draftRequest());
        $events = $this->events;
        self::assertSame(['project' => ['id' => '7']], $service->createAndBindProject($this->requestContext(), 'Renamed', 'skill-code'));
        self::assertSame($events, $this->events);
    }

    #[DataProvider('earlySkillFailures')]
    public function testEarlyProjectFailureDoesNotCreateOrBindSkill(string $failure): void
    {
        try {
            $this->skillService($failure)->createDraft($this->requestContext(), $this->draftRequest());
            self::fail('Expected project creation failure');
        } catch (BusinessException) {
            self::assertNull($this->skill);
            self::assertNotContains('create-skill', $this->events);
            self::assertNotContains('default', $this->events);
            self::assertNotContains('commit', $this->events);
            self::assertNotContains('event', $this->events);
            self::assertSame(0, $this->transactionLevel);
        }
    }

    public static function earlySkillFailures(): array
    {
        return [['identity'], ['project-root']];
    }

    public function testUnauthorizedBindingDoesNotPrepareProjectOrChangeDefault(): void
    {
        $service = $this->skillService(existingSkill: true);
        $service->expects(self::once())->method('assertSkillEditable')->willThrowException(new RuntimeException('Access denied'));
        try {
            $service->createAndBindProject($this->requestContext(), 'Demo', 'skill-code');
            self::fail('Expected permission rejection');
        } catch (RuntimeException $error) {
            self::assertSame('Access denied', $error->getMessage());
            self::assertSame([], $this->events);
            self::assertNull($this->skill?->getProjectId());
        }
    }

    public function testSkillBindingFailureRollsBackTheNewDraftAndDoesNotPublish(): void
    {
        $service = $this->skillService('bind-skill');
        try {
            $service->createDraft($this->requestContext(), $this->draftRequest());
            self::fail('Expected binding failure');
        } catch (BusinessException) {
            self::assertNull($this->skill);
            self::assertSame('rollback', end($this->events));
            self::assertContains('bind-skill', $this->events);
            self::assertNotContains('default', $this->events);
            self::assertNotContains('commit', $this->events);
            self::assertNotContains('event', $this->events);
            self::assertSame(0, $this->transactionLevel);
        }
    }

    public function testWebBindingFailureKeepsExistingDraftUnbound(): void
    {
        $service = $this->skillService('bind-skill', existingSkill: true);
        try {
            $service->createAndBindProject($this->requestContext(), 'Demo', 'skill-code');
            self::fail('Expected binding failure');
        } catch (BusinessException) {
            self::assertNotNull($this->skill);
            self::assertNull($this->skill->getProjectId());
            self::assertNotContains('default', $this->events);
            self::assertNotContains('event', $this->events);
        }
    }

    public function testSkillRetryAfterPostCommitEventFailureDoesNotCreateAnotherProject(): void
    {
        $service = $this->skillService('event');
        try {
            $service->createDraft($this->requestContext(), $this->draftRequest());
            self::fail('Expected event failure');
        } catch (BusinessException) {
            self::assertSame(7, $this->skill?->getProjectId());
            self::assertNotContains('rollback', $this->events);
        }
        $events = $this->events;
        self::assertSame('7', $service->createDraft($this->requestContext(), $this->draftRequest())['project_id']);
        self::assertSame($events, $this->events);
    }

    #[DataProvider('owners')]
    public function testEveryOwnerFinalizesAfterAllBusinessWork(string $owner, string $lastBusinessStep): void
    {
        $response = $this->service()->{$owner}($this->requestContext(), $this->request($owner));
        self::assertIsArray($response);
        $defaultIndex = array_search('default', $this->events, true);
        self::assertIsInt($defaultIndex);
        self::assertSame('commit', $this->events[$defaultIndex + 1]);
        self::assertLessThan($defaultIndex, array_search($lastBusinessStep, $this->events, true));
        self::assertSame(['identity', 'begin'], array_slice(array_values(array_filter($this->events, static fn ($event) => in_array($event, ['identity', 'begin'], true))), 0, 2));
        self::assertSame(1, count(array_keys($this->events, 'default', true)));
        self::assertNotContains('rollback', $this->events);
        self::assertSame(0, $this->transactionLevel);
        if ($owner === 'forkProject') {
            self::assertSame('publish', end($this->events));
        }
    }

    #[DataProvider('owners')]
    public function testLastBusinessFailureDoesNotChangeDefault(string $owner, string $lastBusinessStep): void
    {
        try {
            $this->service($lastBusinessStep)->{$owner}($this->requestContext(), $this->request($owner));
            self::fail('Expected injected business failure');
        } catch (BusinessException|RuntimeException $e) {
            self::assertNotSame('', $e->getMessage());
        }
        self::assertContains($lastBusinessStep, $this->events);
        self::assertSame('rollback', $this->events[count($this->events) - ($owner === 'createOrGetSpecialProject' || $owner === 'createMicroAppProject' ? 2 : 1)]);
        self::assertNotContains('default', $this->events);
        self::assertNotContains('commit', $this->events);
        self::assertNotContains('publish', $this->events);
    }

    #[DataProvider('owners')]
    public function testDefaultFailureRollsBackWithoutPublishing(string $owner, string $lastBusinessStep): void
    {
        try {
            $this->service('default')->{$owner}($this->requestContext(), $this->request($owner));
            self::fail('Expected default update failure');
        } catch (BusinessException|RuntimeException) {
            self::assertContains($lastBusinessStep, $this->events);
            self::assertContains('rollback', $this->events);
            self::assertNotContains('commit', $this->events);
            self::assertNotContains('event', $this->events);
            self::assertNotContains('publish', $this->events);
        }
    }

    public static function owners(): array
    {
        return [
            ['createProject', 'project-root'],
            ['createOrGetSpecialProject', 'setting'],
            ['forkProject', 'audio-copy'],
            ['createAgentProject', 'template-upload'],
            ['createAudioProject', 'audio-extension'],
            ['createMicroAppProject', 'micro-app-extension'],
        ];
    }

    public function testExistingSpecialProjectDoesNotPrepareConversations(): void
    {
        $response = $this->service(existingSpecialProject: true)->createOrGetSpecialProject($this->requestContext(), $this->request('createOrGetSpecialProject'));
        self::assertTrue($response['is_existing']);
        self::assertSame([], $this->events);
    }

    public function testMissingMagicClawCodeFailsBeforeIdentityCreation(): void
    {
        try {
            $this->service()->createAgentProject($this->requestContext(), $this->request('createAgentProject'), ProjectMode::MAGICLAW);
            self::fail('Expected validation failure');
        } catch (BusinessException) {
            self::assertSame([], $this->events);
        }
    }

    public function testEventFailureAfterCommitDoesNotRollBack(): void
    {
        try {
            $this->service('event')->createProject($this->requestContext(), $this->request('createProject'));
            self::fail('Expected event failure');
        } catch (BusinessException) {
            self::assertContains('commit', $this->events);
            self::assertNotContains('rollback', $this->events);
        }
    }

    private function draftRequest(): CreateSkillDraftRequestDTO
    {
        $request = new CreateSkillDraftRequestDTO();
        $request->requestId = 'same-request';
        $request->name = 'Weekly feedback';
        $request->description = 'Use when preparing customer feedback reports';
        return $request;
    }

    /** Exercise both real application services and Hyperf transaction nesting; stub persistence only. */
    private function skillService(?string $failure = null, bool $existingSkill = false): SkillAppService
    {
        $pdo = $this->createMock(PDO::class);
        $snapshot = null;
        $pdo->method('beginTransaction')->willReturnCallback(function () use (&$snapshot): bool {
            $snapshot = $this->skill === null ? null : clone $this->skill;
            $this->transactionLevel = 1;
            $this->events[] = 'begin';
            return true;
        });
        $pdo->method('commit')->willReturnCallback(function (): bool {
            $this->transactionLevel = 0;
            $this->events[] = 'commit';
            return true;
        });
        $pdo->method('rollBack')->willReturnCallback(function () use (&$snapshot): bool {
            $this->skill = $snapshot;
            $this->transactionLevel = 0;
            $this->events[] = 'rollback';
            return true;
        });
        $pdo->method('inTransaction')->willReturnCallback(fn () => $this->transactionLevel > 0);
        $pdo->method('exec')->willReturn(0);
        $connection = new MySqlConnection($pdo, 'unit_test');
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($connection);
        $this->services[ConnectionResolverInterface::class] = $resolver;
        foreach ([ThirdPlatformDataIsolationManagerInterface::class, SubscriptionManagerInterface::class, OrganizationInfoManagerInterface::class] as $interface) {
            $this->services[$interface] = $this->createMock($interface);
        }
        $container = $this->getMockBuilder(ContainerInterface::class)->onlyMethods(['get', 'has'])->addMethods(['make'])->getMock();
        $container->method('get')->willReturnCallback(fn ($id) => $this->services[$id] ?? throw new RuntimeException('Unexpected dependency: ' . $id));
        $container->method('make')->willReturnCallback(fn ($id) => $this->services[$id] ?? throw new RuntimeException('Unexpected dependency: ' . $id));
        $container->method('has')->willReturnCallback(fn ($id) => isset($this->services[$id]));
        $this->services[Db::class] = new Db($container);
        ApplicationContext::setContainer($container);
        $skillDomain = $this->createMock(SkillDomainService::class);
        $skillDomain->method('findOptionalSkillByCode')->willReturnCallback(fn () => $this->skill);
        $skillDomain->method('findUserSkillByCode')->willReturnCallback(fn () => $this->skill ?? throw new RuntimeException('Skill not found'));
        $skillDomain->method('saveSkill')->willReturnCallback(function ($scope, SkillEntity $skill) use ($failure): SkillEntity {
            self::assertSame(1, $this->transactionLevel);
            if ($skill->getProjectId()) {
                $this->events[] = 'bind-skill';
                if ($failure === 'bind-skill') {
                    throw new RuntimeException('Binding failed');
                }
            } else {
                $this->events[] = 'create-skill';
            }
            $skill->setId(123);
            return $this->skill = $skill;
        });
        $skillDomain->method('lockSkill')->willReturnCallback(function (): void {
            self::assertSame(1, $this->transactionLevel);
        });
        if ($existingSkill) {
            $this->skill = new SkillEntity(['id' => 123, 'code' => 'skill-code', 'organization_code' => 'org', 'creator_id' => 'user', 'source_type' => 'DIALOGUE_CREATION', 'name_i18n' => ['default' => 'Demo']]);
        }
        $redis = $this->getMockBuilder(Redis::class)->disableOriginalConstructor()->addMethods(['get', 'setex'])->getMock();
        $redis->method('get')->willReturn('skill-code');
        $redis->method('setex')->willReturn(true);
        $service = $this->getMockBuilder(SkillAppService::class)->disableOriginalConstructor()
            ->onlyMethods(['assertSkillEditable', 'acquireImportLock', 'releaseImportLock', 'createSkillDataIsolation'])->getMock();
        $service->method('acquireImportLock')->willReturn('owner');
        $service->method('createSkillDataIsolation')->willReturn(SkillDataIsolation::create('org', 'user'));
        $policy = $this->createMock(ResourceAccessPolicyService::class);
        $permissions = $this->createMock(OperationPermissionRepositoryInterface::class);
        $permissions->method('save')->willReturnArgument(1);
        $this->inject($service, [
            'projectAppService' => $this->service($failure),
            'skillDomainService' => $skillDomain,
            'resourceAccessPolicyService' => $policy,
            'operationPermissionDomainService' => new OperationPermissionDomainService($permissions, $this->createMock(MagicGroupRepositoryInterface::class), $this->createMock(MagicDepartmentUserRepositoryInterface::class)),
            'redis' => $redis,
        ]);
        return $service;
    }

    private function request(string $owner): object
    {
        return match ($owner) {
            'createProject' => new CreateProjectRequestDTO(['workspace_id' => '1']),
            'createOrGetSpecialProject' => new CreateSpecialProjectRequestDTO(['key' => 'test']),
            'forkProject' => new ForkProjectRequestDTO(['source_project_id' => '5', 'target_workspace_id' => '1']),
            'createAgentProject' => new CreateAgentProjectRequestDTO(),
            'createAudioProject' => new CreateAudioProjectRequestDTO(),
            'createMicroAppProject' => new CreateMicroAppProjectRequestDTO(),
            default => throw new RuntimeException('Unknown creation owner: ' . $owner),
        };
    }

    private function service(?string $failure = null, bool $existingSpecialProject = false): ProjectAppService
    {
        if (! defined('BASE_PATH')) {
            define('BASE_PATH', dirname(__DIR__, 6));
        }
        $record = function (string $event) use ($failure): void {
            $this->events[] = $event;
            if ($event === $failure) {
                throw new RuntimeException($event . ' failed');
            }
        };
        $project = $this->project();
        $workspace = new WorkspaceEntity(['id' => 1, 'user_id' => 'user', 'user_organization_code' => 'org']);
        $workspaces = $this->createMock(WorkspaceDomainService::class);
        $workspaces->method('getWorkspaceDetail')->willReturn($workspace);
        $workspaces->method('getOrCreateWorkspaceByType')->willReturn($workspace);
        $workspaces->method('saveWorkspaceEntity')->willReturnCallback(function ($entity) use ($record) {
            $record('workspace');
            return $entity;
        });
        $projects = $this->createMock(ProjectDomainService::class);
        $projects->method('createProject')->willReturn($project);
        $projects->method('getProjectNotUserId')->willReturn($project);
        $projects->method('saveProjectEntity')->willReturnCallback(function ($entity) use ($record) {
            $record('project');
            return $entity;
        });
        $projects->method('forkProject')->willReturn([$project, new ProjectForkEntity(['id' => 8, 'source_project_id' => 5, 'fork_project_id' => 7])]);
        $topics = $this->createMock(TopicDomainService::class);
        $topics->method('createTopic')->willReturnCallback(function () use ($record) {
            $record('topic');
            return $this->topic();
        });
        $members = $this->createMock(ProjectMemberDomainService::class);
        $members->method('initializeProjectMemberAndSettings')->willReturnCallback(static function () use ($record): void { $record('members'); });
        $files = $this->createMock(TaskFileDomainService::class);
        foreach (['findOrCreateTopicRootDirectory' => 'topic-root', 'findOrCreateProjectRootDirectory' => 'project-root'] as $method => $event) {
            $files->method($method)->willReturnCallback(function () use ($record, $event): int {
                self::assertSame(1, $this->transactionLevel);
                self::assertNotContains('default', $this->events);
                $record($event);
                return 1;
            });
        }
        $file = new TaskFileEntity(['file_id' => 2]);
        $files->method('createProjectFile')->willReturn($file);
        $files->method('createProjectFileWithContent')->willReturnCallback(function () use ($record, $file) {
            self::assertSame(1, $this->transactionLevel);
            self::assertNotContains('default', $this->events);
            $record('template-upload');
            return $file;
        });
        $settingsRepository = $this->createMock(MagicUserSettingRepositoryInterface::class);
        $settingsLocker = $this->createMock(LockerInterface::class);
        $settingsLocker->method('mutexLock')->willReturn(true);
        $settings = new MagicUserSettingDomainService($settingsRepository, $settingsLocker);
        $settingsRepository->method('get')->willReturn($existingSpecialProject ? new MagicUserSettingEntity(['value' => ['project_id' => 7]]) : null);
        $settingsRepository->method('save')->willReturnCallback(static function ($isolation, $entity) use ($record) {
            $record('setting');
            return $entity;
        });
        $projectRepository = $this->createMock(ProjectRepositoryInterface::class);
        $projectRepository->method('findById')->willReturn($project);
        $audio = $this->createMock(AudioProjectDomainService::class);
        $audio->method('copyAudioProjectForFork')->willReturnCallback(static function () use ($record): void { $record('audio-copy'); });
        $audio->method('createAudioProject')->willReturnCallback(static function () use ($record) {
            $record('audio-extension');
            return new AudioProjectEntity(['id' => 9, 'project_id' => 7]);
        });
        $microApps = $this->createMock(MicroAppRepositoryInterface::class);
        $microApps->method('ensureByProjectId')->willReturnCallback(static function () use ($record) {
            $record('micro-app-extension');
            return new MicroAppEntity(['id' => 10]);
        });
        $shares = $this->createMock(ResourceShareDomainService::class);
        $shares->method('getShareByResourceId')->willReturn(new ResourceShareEntity(['resource_type' => ResourceType::Project->value]));
        $locker = $this->createMock(LockerInterface::class);
        $locker->method('mutexLock')->willReturn(true);
        $locker->method('spinLock')->willReturn(true);
        $locker->method('release')->willReturnCallback(static function () use ($record): bool {
            $record('release');
            return true;
        });
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->method('dispatch')->willReturnCallback(function ($event) use ($record) {
            if ($this->transactionLevel === 0 && in_array('commit', $this->events, true)) {
                $record('event');
            }
            return $event;
        });
        $this->services[EventDispatcherInterface::class] = $dispatcher;
        $producer = $this->createMock(Producer::class);
        $producer->method('produce')->willReturnCallback(function () use ($record): bool {
            self::assertSame(0, $this->transactionLevel);
            $record('publish');
            return true;
        });
        $service = (new ReflectionClass(ProjectAppService::class))->newInstanceWithoutConstructor();
        $this->inject($service, ['chatAppService' => $this->chat($failure), 'workspaceDomainService' => $workspaces, 'projectDomainService' => $projects, 'topicDomainService' => $topics, 'projectMemberDomainService' => $members, 'taskFileDomainService' => $files, 'magicUserSettingDomainService' => $settings, 'projectRepository' => $projectRepository, 'audioProjectDomainService' => $audio, 'microAppRepository' => $microApps, 'resourceShareDomainService' => $shares, 'locker' => $locker, 'eventDispatcher' => $dispatcher, 'producer' => $producer]);
        return $service;
    }
}
