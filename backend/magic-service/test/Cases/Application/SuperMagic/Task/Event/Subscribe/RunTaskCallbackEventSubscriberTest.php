<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Task\Event\Subscribe;

use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\SuperMagic\Task\Event\Subscribe\RunTaskCallbackEventSubscriber;
use App\Domain\Asr\Service\AsrTaskDomainService;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\SuperMagic\File\Entity\AudioProjectEntity;
use App\Domain\SuperMagic\File\Service\AudioProjectDomainService;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageMetadata;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessagePayload;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Event\RunTaskCallbackEvent;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Entity\WorkspaceEntity;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\Interfaces\SuperMagic\Message\DTO\TopicTaskMessageDTO;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Snowflake\IdGeneratorInterface;
use Hyperf\SocketIOServer\NamespaceInterface;
use Hyperf\SocketIOServer\Room\AdapterInterface;
use Hyperf\SocketIOServer\SocketIO;
use LogicException;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;

/**
 * 录音总结完成回调监听器测试.
 *
 * 回调身份判断：topic_mode=summary 决定业务域，audio_project phase 决定流程状态，
 * 不再依赖用户消息中的 summary_task 标记（follow-up 任务没有该标记）。
 *
 * @internal
 */
class RunTaskCallbackEventSubscriberTest extends TestCase
{
    private const int TOPIC_ID = 935903207424868355;

    private const int PROJECT_ID = 935903207290650625;

    private const int WORKSPACE_ID = 735903207290650001;

    private const int TASK_ID = 947058613065277441;

    private FakeContainer $container;

    private FakeNamespace $namespace;

    protected function setUp(): void
    {
        parent::setUp();

        $idGenerator = $this->createMock(IdGeneratorInterface::class);
        $idGenerator->method('generate')->willReturnCallback(static fn (): int => random_int(1, PHP_INT_MAX));

        $this->container = new FakeContainer();
        $this->container->services[IdGeneratorInterface::class] = $idGenerator;
        $this->namespace = new FakeNamespace();
        $socketIO = $this->createMock(SocketIO::class);
        $socketIO->method('of')->willReturn($this->namespace);
        $this->container->services[SocketIO::class] = $socketIO;

        ApplicationContext::setContainer($this->container);
    }

    /**
     * 首次总结成功：summarizing/in_progress + finished → completed，推送成功通知.
     */
    public function testFinishedCallbackCompletesInProgressSummarizingPhase(): void
    {
        $audioProject = $this->createAudioProject('summarizing', 'in_progress');

        $audioProjectDomainService = $this->createMock(AudioProjectDomainService::class);
        $audioProjectDomainService->method('getAudioProjectByProjectId')->willReturn($audioProject);
        // AsrTaskDomainService 找不到任务状态 → 走实体直改兜底
        $audioProjectDomainService->expects($this->once())->method('save');
        $this->container->services[AudioProjectDomainService::class] = $audioProjectDomainService;

        $asrRecorder = new AsrCallRecorder();
        // findTaskByKey / rebuildFromDatabase 均返回 null
        $this->container->services[AsrTaskDomainService::class] = new FakeAsrTaskDomainService(null, $asrRecorder);

        $this->createSubscriber()->process($this->createEvent('finished'));

        $this->assertSame('summarizing', $audioProject->getCurrentPhase());
        $this->assertSame('completed', $audioProject->getPhaseStatus());
        $this->assertSame(100, $audioProject->getPhasePercent());
        $this->assertSame([], $asrRecorder->calls);
        $this->assertCount(1, $this->namespace->emitted);
        $this->assertTrue($this->namespace->emitted[0][1]['recording_summary_result']['success']);
    }

    /**
     * 首次总结失败：summarizing/in_progress + error → failed，推送失败通知.
     */
    public function testErrorCallbackFailsInProgressSummarizingPhase(): void
    {
        $audioProject = $this->createAudioProject('summarizing', 'in_progress');

        $audioProjectDomainService = $this->createMock(AudioProjectDomainService::class);
        $audioProjectDomainService->method('getAudioProjectByProjectId')->willReturn($audioProject);
        $audioProjectDomainService->expects($this->once())->method('save');
        $this->container->services[AudioProjectDomainService::class] = $audioProjectDomainService;

        $this->container->services[AsrTaskDomainService::class] = new FakeAsrTaskDomainService();

        $this->createSubscriber()->process($this->createEvent('error'));

        $this->assertSame('failed', $audioProject->getPhaseStatus());
        $this->assertNotNull($audioProject->getPhaseError());
        $this->assertCount(1, $this->namespace->emitted);
        $this->assertFalse($this->namespace->emitted[0][1]['recording_summary_result']['success']);
    }

    /**
     * 本次 bug 场景：首次总结失败后的 follow-up 任务（无 summary_task 标记）成功
     * summarizing/failed + finished → completed.
     */
    public function testFinishedFollowUpCallbackCompletesFailedPhaseWithoutSummaryTaskMarker(): void
    {
        $audioProject = $this->createAudioProject('summarizing', 'failed');

        $audioProjectDomainService = $this->createMock(AudioProjectDomainService::class);
        $audioProjectDomainService->method('getAudioProjectByProjectId')->willReturn($audioProject);
        $audioProjectDomainService->expects($this->once())->method('save');
        $this->container->services[AudioProjectDomainService::class] = $audioProjectDomainService;

        $this->container->services[AsrTaskDomainService::class] = new FakeAsrTaskDomainService();

        $this->createSubscriber()->process($this->createEvent('finished'));

        $this->assertSame('completed', $audioProject->getPhaseStatus());
        $this->assertSame(100, $audioProject->getPhasePercent());
        $this->assertNull($audioProject->getPhaseError());
        $this->assertCount(1, $this->namespace->emitted);
        $this->assertTrue($this->namespace->emitted[0][1]['recording_summary_result']['success']);
    }

    /**
     * AsrTaskDomainService 双写路径：Redis 命中时走领域服务而不是实体直改.
     */
    public function testFinishedCallbackUsesAsrTaskDomainServiceWhenTaskStatusFound(): void
    {
        $audioProject = $this->createAudioProject('summarizing', 'in_progress');

        $audioProjectDomainService = $this->createMock(AudioProjectDomainService::class);
        $audioProjectDomainService->method('getAudioProjectByProjectId')->willReturn($audioProject);
        $audioProjectDomainService->expects($this->never())->method('save');
        $this->container->services[AudioProjectDomainService::class] = $audioProjectDomainService;

        $asrRecorder = new AsrCallRecorder();
        $this->container->services[AsrTaskDomainService::class] = new FakeAsrTaskDomainService(
            new AsrTaskStatusDTO(['task_key' => 'task-key-1']),
            $asrRecorder
        );

        $this->createSubscriber()->process($this->createEvent('finished'));

        $this->assertSame(['completeSummarizingPhase'], $asrRecorder->calls);
        $this->assertCount(1, $this->namespace->emitted);
    }

    /**
     * 幂等：总结完成后的普通聊天 / 重复 finished 回调不再更新、不再推送.
     */
    public function testFinishedCallbackAfterCompletedIsIdempotent(): void
    {
        $audioProject = $this->createAudioProject('summarizing', 'in_progress');

        $audioProjectDomainService = $this->createMock(AudioProjectDomainService::class);
        // 两次回调返回同一个实体实例，第一次完成后第二次应被 phase 门槛跳过
        $audioProjectDomainService->method('getAudioProjectByProjectId')->willReturn($audioProject);
        $audioProjectDomainService->expects($this->once())->method('save');
        $this->container->services[AudioProjectDomainService::class] = $audioProjectDomainService;

        $this->container->services[AsrTaskDomainService::class] = new FakeAsrTaskDomainService();

        $subscriber = $this->createSubscriber();
        $subscriber->process($this->createEvent('finished'));
        // 重复回调 / 总结完成后的普通聊天完成回调
        $subscriber->process($this->createEvent('finished'));

        $this->assertSame('completed', $audioProject->getPhaseStatus());
        $this->assertCount(1, $this->namespace->emitted);
    }

    /**
     * 失败后的重复 error 回调：首次失败已记录，跳过重复失败处理.
     */
    public function testErrorCallbackAfterFailedIsSkipped(): void
    {
        $audioProject = $this->createAudioProject('summarizing', 'failed');

        $audioProjectDomainService = $this->createMock(AudioProjectDomainService::class);
        $audioProjectDomainService->method('getAudioProjectByProjectId')->willReturn($audioProject);
        $audioProjectDomainService->expects($this->never())->method('save');
        $this->container->services[AudioProjectDomainService::class] = $audioProjectDomainService;

        $this->createSubscriber()->process($this->createEvent('error'));

        $this->assertSame('failed', $audioProject->getPhaseStatus());
        $this->assertSame('previous error', $audioProject->getPhaseError());
        $this->assertCount(0, $this->namespace->emitted);
    }

    /**
     * 非总结生命周期阶段（如 merging）的回调不处理.
     */
    public function testCallbackForNonSummarizingPhaseIsSkipped(): void
    {
        $audioProject = $this->createAudioProject('merging', 'in_progress');

        $audioProjectDomainService = $this->createMock(AudioProjectDomainService::class);
        $audioProjectDomainService->method('getAudioProjectByProjectId')->willReturn($audioProject);
        $audioProjectDomainService->expects($this->never())->method('save');
        $this->container->services[AudioProjectDomainService::class] = $audioProjectDomainService;

        $this->createSubscriber()->process($this->createEvent('finished'));

        $this->assertSame('merging', $audioProject->getCurrentPhase());
        $this->assertSame('in_progress', $audioProject->getPhaseStatus());
        $this->assertCount(0, $this->namespace->emitted);
    }

    /**
     * 非 summary 话题：不查询、不更新 audio_project.
     */
    public function testNonSummaryTopicIsIgnored(): void
    {
        $this->container->services[TopicDomainService::class] = $this->createTopicDomainService(ProjectMode::GENERAL->value);

        $audioProjectDomainService = $this->createMock(AudioProjectDomainService::class);
        $audioProjectDomainService->expects($this->never())->method('getAudioProjectByProjectId');
        $this->container->services[AudioProjectDomainService::class] = $audioProjectDomainService;

        $this->createSubscriber()->process($this->createEvent('finished'));

        $this->assertCount(0, $this->namespace->emitted);
    }

    /**
     * summary 话题但没有 audio_project（未走音频项目创建接口的录音）：安全忽略.
     */
    public function testSummaryTopicWithoutAudioProjectIsIgnored(): void
    {
        $audioProjectDomainService = $this->createMock(AudioProjectDomainService::class);
        $audioProjectDomainService->method('getAudioProjectByProjectId')->willReturn(null);
        $audioProjectDomainService->expects($this->never())->method('save');
        $this->container->services[AudioProjectDomainService::class] = $audioProjectDomainService;

        $this->createSubscriber()->process($this->createEvent('finished'));

        $this->assertCount(0, $this->namespace->emitted);
    }

    private function createSubscriber(): RunTaskCallbackEventSubscriber
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        // 未单独指定的服务使用默认实现：summary 话题 + 基础用户/项目/工作区
        $this->container->services[TopicDomainService::class] ??= $this->createTopicDomainService(ProjectMode::SUMMARY->value);
        $this->container->services[MagicUserDomainService::class] ??= $this->createMagicUserDomainService();
        $this->container->services[ProjectDomainService::class] ??= $this->createProjectDomainService();
        $this->container->services[WorkspaceDomainService::class] ??= $this->createWorkspaceDomainService();
        $this->container->services[AsrTaskDomainService::class] ??= new FakeAsrTaskDomainService();

        return new RunTaskCallbackEventSubscriber($loggerFactory);
    }

    private function createEvent(string $status): RunTaskCallbackEvent
    {
        $payload = MessagePayload::fromArray(['status' => $status]);
        $taskMessage = new TopicTaskMessageDTO(new MessageMetadata(), $payload);

        return new RunTaskCallbackEvent(
            'org-code',
            'user-1',
            self::TOPIC_ID,
            'topic-name',
            self::TASK_ID,
            $taskMessage,
            'zh_CN'
        );
    }

    private function createTopic(string $topicMode): TopicEntity
    {
        $topic = new TopicEntity();
        $topic->setId(self::TOPIC_ID);
        $topic->setProjectId(self::PROJECT_ID);
        $topic->setWorkspaceId(self::WORKSPACE_ID);
        $topic->setTopicMode($topicMode);
        return $topic;
    }

    private function createAudioProject(string $currentPhase, ?string $phaseStatus): AudioProjectEntity
    {
        $audioProject = new AudioProjectEntity();
        $audioProject->setProjectId(self::PROJECT_ID);
        $audioProject->setTaskKey('task-key-1');
        $audioProject->setCurrentPhase($currentPhase);
        $audioProject->setPhaseStatus($phaseStatus);
        if ($phaseStatus === 'failed') {
            $audioProject->setPhaseError('previous error');
        }
        return $audioProject;
    }

    private function createTopicDomainService(string $topicMode): TopicDomainService
    {
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $topicDomainService->method('getTopicById')->willReturn($this->createTopic($topicMode));
        return $topicDomainService;
    }

    private function createMagicUserDomainService(): MagicUserDomainService
    {
        $user = new MagicUserEntity();
        $user->setMagicId('magic-user-1');

        $magicUserDomainService = $this->createMock(MagicUserDomainService::class);
        $magicUserDomainService->method('getUserById')->willReturn($user);
        return $magicUserDomainService;
    }

    private function createProjectDomainService(): ProjectDomainService
    {
        $project = new ProjectEntity();
        $project->setProjectMode(ProjectMode::SUMMARY->value);
        $project->setProjectName('audio project');

        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $projectDomainService->method('getProjectNotUserId')->willReturn($project);
        return $projectDomainService;
    }

    private function createWorkspaceDomainService(): WorkspaceDomainService
    {
        $workspace = new WorkspaceEntity();
        $workspace->setName('workspace');

        $workspaceDomainService = $this->createMock(WorkspaceDomainService::class);
        $workspaceDomainService->method('getWorkspaceDetail')->willReturn($workspace);
        return $workspaceDomainService;
    }
}

/**
 * 测试用内存容器，按 class 名返回预置的 mock 服务.
 */
class FakeContainer implements ContainerInterface
{
    /** @var array<string, mixed> */
    public array $services = [];

    public function get(string $id): mixed
    {
        return $this->services[$id] ?? null;
    }

    public function has(string $id): bool
    {
        return isset($this->services[$id]);
    }
}

/**
 * AsrTaskDomainService 是 readonly 无法 mock，用手写 fake 替代.
 */
readonly class FakeAsrTaskDomainService extends AsrTaskDomainService
{
    public function __construct(
        private ?AsrTaskStatusDTO $taskStatus = null,
        private ?AsrCallRecorder $recorder = new AsrCallRecorder(),
    ) {
    }

    public function findTaskByKey(string $taskKey, string $userId): ?AsrTaskStatusDTO
    {
        return $this->taskStatus;
    }

    public function rebuildFromDatabase(string $taskKey, string $userId): ?AsrTaskStatusDTO
    {
        return $this->taskStatus;
    }

    public function completeSummarizingPhase(AsrTaskStatusDTO $taskStatus, int $ttl = 604800): void
    {
        $this->recorder?->record('completeSummarizingPhase');
    }

    public function failSummarizingPhase(AsrTaskStatusDTO $taskStatus, string $error, int $ttl = 604800): void
    {
        $this->recorder?->record('failSummarizingPhase');
    }
}

class AsrCallRecorder
{
    /** @var string[] */
    public array $calls = [];

    public function record(string $method): void
    {
        $this->calls[] = $method;
    }
}

/**
 * 记录 emit 调用的假命名空间，用于断言 socket 推送.
 */
class FakeNamespace implements NamespaceInterface
{
    /** @var array<int, array{string, mixed}> */
    public array $emitted = [];

    public function to(int|string $roomId): self
    {
        return $this;
    }

    public function emit(string $event, mixed $data): void
    {
        $this->emitted[] = [$event, $data];
    }

    public function getEventHandlers(): array
    {
        return [];
    }

    public function getNamespace(): string
    {
        return '/';
    }

    public function getAdapter(): AdapterInterface
    {
        throw new LogicException('not used in tests');
    }
}
