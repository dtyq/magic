<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Service;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\File\Service\FileAppService;
use App\Application\SuperMagic\Common\Service\VideoModelConfigResolver;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Exception\MagicClawRuntimeDeniedException;
use App\Domain\SuperMagic\Agent\Repository\Facade\MagicClawRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Persistence\MagicClawReconciliationRepository;
use App\Domain\SuperMagic\Agent\Service\MagicClawRuntimePolicyDomainService;
use App\Domain\SuperMagic\Common\Entity\ValueObject\DynamicConfig\DynamicConfigManager;
use App\Domain\SuperMagic\Common\Entity\ValueObject\SuperMagicProductContext;
use App\Domain\SuperMagic\Common\Entity\ValueObject\UserInfoValueObject;
use App\Domain\SuperMagic\Message\Entity\ValueObject\ChatInstruction;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageMetadata;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageType;
use App\Domain\SuperMagic\Message\Repository\Facade\TaskMessageRepositoryInterface;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Task\Constant\AgentConstant;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\AgentContext;
use App\Domain\SuperMagic\Task\Entity\ValueObject\AgentInitContext;
use App\Domain\SuperMagic\Task\Entity\ValueObject\InitializationMetadataDTO;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRootFileIds;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskContext;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Repository\Facade\TopicRepositoryInterface;
use App\Domain\SuperMagic\Workspace\Exception\WorkspaceReadyTimeoutException;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceRepositoryInterface;
use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\SizeManager;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Constant\WorkspaceStatus;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Request\AskUserResponseMessageRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Request\ChatMessageRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackCheckRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackCommitRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackStartRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Request\CheckpointRollbackUndoRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Request\InterruptRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Request\UserToolCallFeedbackRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\SandboxAgentInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\UserToolCallNotFoundException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\UserToolCallRecoveryException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\SandboxListResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use App\Infrastructure\SuperMagic\Task\Locker\SandboxLifecycleLock;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Carbon\Carbon;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Server\Exception\ServerException;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Agent消息应用服务
 * 提供高级Agent通信功能，包括自动初始化和状态管理.
 */
class AgentDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly SandboxGatewayInterface $gateway,
        private readonly SandboxAgentInterface $agent,
        private readonly MagicUserInfoAppService $userInfoAppService,
        private readonly CloudFileRepositoryInterface $cloudFileRepository,
        private readonly DynamicConfigManager $dynamicConfigManager,
        private readonly MagicClawRepositoryInterface $magicClawRepository,
        private readonly SuperMagicAgentRepositoryInterface $superMagicAgentRepository,
        private readonly MagicTokenRepositoryInterface $magicTokenRepository,
        private readonly ProjectRepositoryInterface $projectRepository,
        private readonly TopicRepositoryInterface $topicRepository,
        private readonly WorkspaceRepositoryInterface $workspaceRepository,
        private readonly TaskMessageRepositoryInterface $taskMessageRepository,
        private readonly CrossProjectMentionPathTranslator $crossProjectMentionPathTranslator,
    ) {
        $this->logger = $loggerFactory->get('sandbox');
    }

    public function buildInitAgentContext(DataIsolation $dataIsolation, ProjectEntity $projectEntity, TopicEntity $topicEntity, TaskEntity $taskEntity, string $sandboxId = '', bool $skipInitMessage = false, array $memories = [], array $extraSubscriptionConfigs = [])
    {
        if (empty($sandboxId)) {
            // 默认使用话题id
            $sandboxId = (string) $topicEntity->getId();
        }
        $authToken = $dataIsolation->getUserAuthorizationToken() ?? '';
        // todo 初始化数据, 后续有些参数需要精简去掉
        $superMagicProductContext = $this->buildSuperMagicProductContext(
            $projectEntity,
            $topicEntity,
            $sandboxId
        );
        $agentInitContext = AgentInitContext::createDefault($superMagicProductContext);
        $agentInitContext->setMessageId((string) IdGenerator::getSnowId());
        $agentInitContext->setUserId($dataIsolation->getCurrentUserId()); // 待废弃
        $agentInitContext->setProjectId((string) $projectEntity->getId()); // 待废弃
        $agentInitContext->setType(MessageType::Init->value);
        // 设置对象存储的 sts token
        $projectDir = WorkDirectoryUtil::getRootDir($dataIsolation->getCurrentUserId(), $projectEntity->getId());
        $stsConfig = di(FileAppService::class)->getDualEndpointStsCredentialV2(
            $projectEntity->getUserOrganizationCode(),
            StorageBucketType::SandBox->value,
            $projectDir,
            3600,
            false,
            // 沙箱内 agent 需要直接删除工作目录下的对象（如 checkpoint 清理），凭证需同时含上传与删除权限
            ['sts_type' => 'upload_objects|del_objects']
        );
        $agentInitContext->setUploadConfig($stsConfig);
        // 设置消息回调接口（数组格式，支持多个订阅目标）
        $systemSubscriptionItem = [
            'method' => 'POST',
            'url' => config('super-magic.sandbox.callback_host', '') . '/api/v1/super-agent/tasks/deliver-message',
            'auth_scheme' => 'header_token',
            'headers' => [
                'token' => '',
            ],
        ];
        if (count($extraSubscriptionConfigs) > 0) {
            $agentInitContext->setMessageSubscriptionConfig(
                array_merge([$systemSubscriptionItem], $extraSubscriptionConfigs)
            );
        } else {
            $agentInitContext->setMessageSubscriptionConfig($systemSubscriptionItem);
        }
        // 设置 sts refresh 接口
        $refreshConfig = [
            'method' => 'POST',
            'url' => config('super-magic.sandbox.callback_host', '') . '/api/v1/super-agent/file/refresh-sts-token',
            'headers' => [
                'token' => '',
            ],
        ];
        $agentInitContext->setStsTokenRefresh($refreshConfig);
        // 设置 metadata (待废弃)
        $userInfoArray = di(MagicUserInfoAppService::class)->getUserInfo($dataIsolation->getCurrentUserId(), $dataIsolation);
        $userInfo = UserInfoValueObject::fromArray($userInfoArray);
        // 获取 agent user ，待废弃
        $aiUserEntity = di(MagicUserDomainService::class)->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);
        $metadata = new MessageMetadata(
            agentUserId: $aiUserEntity->getUserId() ?? '',
            userId: $dataIsolation->getCurrentUserId(),
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
            chatConversationId: $this->getTopicDomainService()->getAgentChatConversationId($topicEntity->getChatTopicId(), $topicEntity->getChatConversationId()),
            chatTopicId: $topicEntity->getChatTopicId(),
            topicId: (string) $topicEntity->getId(),
            instruction: ChatInstruction::Normal->value,
            sandboxId: $sandboxId,
            superMagicTaskId: (string) $taskEntity->getId(),
            workspaceId: (string) ($projectEntity->getWorkspaceId() ?? ''),
            projectId: (string) ($projectEntity->getId() ?? ''),
            language: $dataIsolation->getLanguage() ?? 'zh_CN',
            authorization: $authToken,
            userInfo: $userInfo,
            skipInitMessages: $skipInitMessage
        );
        $agentInitContext->setMetadata($metadata->toArray());
        // 设置 agent_mode （待废弃）
        $agentInitContext->setAgentMode($topicEntity->getTopicMode());
        // 设置 magic_service_host
        $agentInitContext->setMagicServiceHost(config('super-magic.sandbox.callback_host', ''));
        $agentInitContext->setMagicServiceWsHost(config('super-magic.sandbox.magic_service_ws_host', ''));
        // 设置记忆
        $agentInitContext->setMemories($memories);
        // 设置路径
        $fullPrefix = $this->cloudFileRepository->getFullPrefix($projectEntity->getUserOrganizationCode());
        $chatWorkDir = WorkDirectoryUtil::getAgentChatHistoryDir($dataIsolation->getCurrentUserId(), $projectEntity->getId());
        $fullChatWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $chatWorkDir);
        $fullWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());
        $agentInitContext->setChatHistoryDir($fullChatWorkDir);
        $agentInitContext->setWorkDir($fullWorkDir);
        // 设置是否需要拉取聊天记录：通过话题消息表判断是否已有历史消息
        $topicId = (int) $topicEntity->getId();
        $topicHasHistory = $topicId > 0 && $this->taskMessageRepository->hasMessagesByTopicId($topicId);
        $agentInitContext->setFetchHistory($topicHasHistory);
        // 将话题的 dynamic_params 作为 dynamic_config 下发，使 sandbox 在 init 阶段即可获取 message_version 等配置
        $dynamicParams = $topicEntity->getDynamicParams();
        if (! empty($dynamicParams)) {
            $agentInitContext->setDynamicConfig($dynamicParams);
        }

        return new AgentContext(
            sandboxId: $sandboxId,
            authToken: $authToken,
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            taskEntity: $taskEntity,
            initContext: $agentInitContext,
        );
    }

    /**
     * Ensure sandbox is initialized and workspace is ready.
     * Uses distributed lock to prevent concurrent sandbox creation.
     * Supports interrupt checking at each step for early termination.
     *
     * 沙箱绑定模型：话题只存一个 sandbox_id 指针，pod 的生死由 K8s 管理，
     * 换绑 = 只改指针，不停 pod：
     *
     *     MySQL topics.sandbox_id                 K8s pod（真实资源）
     *     +----------------------+              +--------------------------+
     *     |     'sandbox-A'      |------------->| pod sandbox-A  Running   |
     *     +----------+-----------+              +--------------------------+
     *                |
     *                | UPDATE sandbox_id = 'sandbox-B'
     *                v
     *     +----------------------+              +--------------------------+
     *     |     'sandbox-B'      |------------->| pod sandbox-B  Running   |
     *     +----------------------+              +--------------------------+
     *                                           +--------------------------+
     *                                           | pod sandbox-A  Running   |
     *                                           +--------------------------+
     *                                             ^^ 指针已绕开它，无人停止
     *                                                => 带着同样的 topic-id /
     *                                                   agent-code 标签泄漏
     *
     * 因此本方法对绑定切换做了三重保护：
     *   1. 拿锁【后】重读 DB 最新绑定（等锁期间可能已被升级/重启、预热池
     *      mount 换绑，拿锁前的快照不可信）；
     *   2. 探测失败不急着绑新的，先给预热池机会（tryWarmPoolFastPath）；
     *   3. 无论 warm/cold 换绑成功，都 releaseReplacedSandbox 停掉旧沙箱。
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param AgentContext $agentContext Agent context with initialization data
     * @param null|SandboxRootFileIds $rootFileIds root file ids to mount
     * @param null|callable $interruptChecker Optional callable that returns true to interrupt initialization
     * @return string Sandbox ID (always valid, even if interrupted after sandbox creation)
     * @throws ServerException If metadata is incomplete or lock acquisition fails
     */
    public function ensureSandboxInitialized(
        DataIsolation $dataIsolation,
        AgentContext $agentContext,
        ?SandboxRootFileIds $rootFileIds = null,
        ?callable $interruptChecker = null,
        ?SandboxImageTarget $images = null
    ): string {
        $topicEntity = $agentContext->getTopicEntity();

        // Resolution order for the sandbox id used by the pre-create workspace
        // status check:
        //   1) explicit id from the AgentContext (reconnect / pinned)
        //   2) the topic's own persisted sandbox_id (set by an earlier
        //      cold-create or warm-pool mount)
        //   3) topic_id stringified — legacy fallback kept so callers that
        //      pre-date the explicit binding still work
        $contextSandboxId = $agentContext->getSandboxId();
        $persistedSandboxId = (string) $topicEntity->getSandboxId();
        $sandboxId = ! empty($contextSandboxId)
            ? $contextSandboxId
            : (! empty($persistedSandboxId)
                ? $persistedSandboxId
                : (string) $topicEntity->getId());

        $this->logger->info('[Sandbox][Domain] Ensuring sandbox is initialized', [
            'topic_id' => $topicEntity->getId(),
            'sandbox_id' => $sandboxId,
            'is_custom_sandbox_id' => $contextSandboxId,
            'persisted_sandbox_id' => $persistedSandboxId,
            'has_interrupt_checker' => $interruptChecker !== null,
            'images' => $images?->describe() ?? 'follow gateway release',
        ]);

        return di(SandboxLifecycleLock::class)->run((int) $topicEntity->getId(), function (callable $assertOwnership) use ($dataIsolation, $agentContext, $rootFileIds, $interruptChecker, $topicEntity, $contextSandboxId, $sandboxId, $images): string {
            $assertOwnership();
            di(MagicClawRuntimePolicyDomainService::class)->assertTopic((int) $topicEntity->getId());
            // 上面的 $sandboxId 是拿锁【前】解析出的快照，等锁期间可能已失效。
            // 典型竞态（A=升级/重启流程，B=本方法的另一次并发调用）：
            //
            //   t0   A: 读 DB 绑定=X           B: 读 DB 绑定=X（快照）
            //   t1   A: 拿锁, 删 pod X,
            //            冷创建 B, 绑定=B      B: 排队等锁...
            //   t2   A: 释放锁                 B: 拿到锁
            //                                      若仍用快照 X 探测 -> NOT_FOUND
            //                                      -> 误判"绑定已丢", 再绑一个 C
            //                                      -> pod B 被绕开, 泄漏
            //                                      重读 DB 绑定=B -> 直接复用 B
            //
            // 所以拿到锁后必须以 DB 现值为准，而不是拿锁前的快照。
            // 调用方显式传入 sandbox_id（重连固定 pod）时保持原语义，不重读。
            if (empty($contextSandboxId)) {
                $freshTopic = $this->topicRepository->getTopicById((int) $topicEntity->getId());
                $freshPersistedSandboxId = (string) ($freshTopic?->getSandboxId() ?? '');
                if ($freshPersistedSandboxId !== '' && $freshPersistedSandboxId !== $sandboxId) {
                    $this->logger->info('[Sandbox][Domain] Re-read topic binding after acquiring lock', [
                        'topic_id' => $topicEntity->getId(),
                        'stale_sandbox_id' => $sandboxId,
                        'fresh_sandbox_id' => $freshPersistedSandboxId,
                    ]);
                    $sandboxId = $freshPersistedSandboxId;
                }
            }

            // 记下"即将被替换"的当前绑定，换绑（warm/cold）成功后据此停旧 pod。
            // 必须在 Step 1 探测之前捕获：探测失败会把 $sandboxId 清空为 ''，
            // 之后就拿不到被替换者是谁了。调用方显式指定 sandbox_id（重连固定
            // pod）时不做释放，保持原语义。
            $boundBeforeSwitch = empty($contextSandboxId) ? $sandboxId : '';

            // Step 1: Check workspace status (quick-returns if sandbox already ready).
            //
            // 如果探测发现 sandbox_id 对应的 pod 已经不存在 / 不在 Ready 状态，
            // 把 agentContext 上残留的 sandboxId 抹空，让后续 Step 2.5 的 warm
            // pool 守卫能够放行，避免「话题里残留的死 sandbox_id 把 warm pool
            // 永久挡在外面、每次都走冷创建」的退化。
            try {
                $response = $this->getWorkspaceStatus($dataIsolation, $sandboxId);
                $status = $response->getDataValue('status');

                if (WorkspaceStatus::isReady($status)) {
                    $this->logger->info('[Sandbox][Domain] Workspace already ready', [
                        'sandbox_id' => $sandboxId,
                        'workspace_status' => $status,
                    ]);
                    $assertOwnership();
                    $this->assertSandboxRuntime((int) $topicEntity->getProjectId(), $sandboxId, (int) $topicEntity->getId());
                    return $sandboxId;
                }

                $this->logger->info('[Sandbox][Domain] Workspace not ready, will reinitialize', [
                    'sandbox_id' => $sandboxId,
                    'workspace_status' => $status,
                ]);
                // 之前缓存的 sandbox_id 已失效，允许 warm pool 接管。
                $agentContext->setSandboxId('');
                $sandboxId = '';
            } catch (SandboxOperationException $e) {
                $isNotFound = $e->getCode() === ResponseCode::NOT_FOUND;
                $logLevel = $isNotFound ? 'info' : 'warning';
                $this->logger->{$logLevel}('[Sandbox][Domain] Failed to check workspace status, will create sandbox', [
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                    'is_not_found' => $isNotFound,
                ]);
                // NOT_FOUND 说明这个 sandbox_id 已经被销毁；其它异常也无法证明 pod 仍
                // 在线。统一把残留 id 抹空，让 warm pool 守卫得以放行。
                $agentContext->setSandboxId('');
                $sandboxId = '';
            }

            if (di(MagicClawRuntimePolicyDomainService::class)->assertTopic((int) $topicEntity->getId()) !== null) {
                // Retire the recorded old pod before replacing its only durable pointer.
                // If deletion is uncertain, keep that pointer for the permission reconciler.
                $currentBinding = (string) ($this->topicRepository->getTopicById((int) $topicEntity->getId())?->getSandboxId() ?? '');
                if ($currentBinding !== '') {
                    $this->stopSandboxIfExists($currentBinding);
                    $this->topicRepository->updateTopicByCondition(['id' => $topicEntity->getId(), 'sandbox_id' => $currentBinding], ['sandbox_id' => '']);
                }
                $boundBeforeSwitch = '';
            }

            // Step 2: Get root file IDs for sandbox initialization
            $projectSpaceRootFileId = $rootFileIds?->getProjectSpaceRootFileId() ?? '';
            $userSpaceRootFileId = $rootFileIds?->getUserSpaceRootFileId() ?? '';
            $topicSpaceRootFileId = $rootFileIds?->getTopicSpaceRootFileId() ?? '';
            // Step 2.5: Warm pool fast path.
            // Only attempt when the caller didn't ask for a specific sandbox id
            // (those are typically reconnects to an existing pod) AND we have
            // a project-space root file id to mount.  On any failure we fall
            // through to the cold path so the user-facing call never breaks.
            //
            // 镜像发布后的重启同样走这里：旧 pod 已被删掉，上面的探测会拿到
            // NOT_FOUND 并抹空 sandbox_id，于是温池守卫放行、直接领一个现成的
            // pod 挂载，而不是从零冷启动。前提是温池由补货流程维持在最新镜像。
            $warmSandboxId = $this->tryWarmPoolFastPath(
                $dataIsolation,
                $agentContext,
                $projectSpaceRootFileId,
                $userSpaceRootFileId,
                $topicSpaceRootFileId,
                $images
            );
            if ($warmSandboxId !== null) {
                $this->releaseReplacedSandbox($boundBeforeSwitch, $warmSandboxId, (int) $topicEntity->getId());
                $sandboxId = $warmSandboxId;
            } else {
                // Step 3: Create sandbox container (cold path)
                // 冷启动一律使用 topic_id 作为 sandbox_id，让沙箱与话题一一对应，
                // 便于排障与去重；调用方即便显式传了 sandbox_id 也以话题为准。
                $createdSandboxId = $this->createSandbox(
                    dataIsolation: $dataIsolation,
                    projectId: (string) $agentContext->getProjectEntity()->getId(),
                    sandboxID: (string) $topicEntity->getId(),
                    workDir: $agentContext?->getInitContext()->getWorkDir() ?? '',
                    projectSpaceRootFileId: $projectSpaceRootFileId,
                    userSpaceRootFileId: $userSpaceRootFileId,
                    topicSpaceRootFileId: $topicSpaceRootFileId,
                    topicId: $topicEntity->getId(),
                    agentCode: $this->resolveAgentCodeLabel($topicEntity),
                    images: $images
                );
                $this->releaseReplacedSandbox($boundBeforeSwitch, $createdSandboxId, (int) $topicEntity->getId());
                $sandboxId = $createdSandboxId;
            }

            $assertOwnership();
            $this->assertSandboxRuntime((int) $topicEntity->getProjectId(), $sandboxId, (int) $topicEntity->getId());
            $this->refreshInitContextSandboxId($agentContext, $sandboxId);

            if ($interruptChecker !== null && $interruptChecker()) {
                $this->logger->info('[Sandbox][Domain] Interrupted after sandbox creation', [
                    'sandbox_id' => $sandboxId,
                    'topic_id' => $topicEntity->getId(),
                ]);
                $assertOwnership();
                $this->assertSandboxRuntime((int) $topicEntity->getProjectId(), $sandboxId, (int) $topicEntity->getId());
                return $sandboxId;
            }

            // Step 3: Initialize agent
            $result = $this->agent->initAgent($dataIsolation, $sandboxId, $agentContext->getInitContext()->toArray());
            if (! $result->isSuccess()) {
                $this->logger->error('[Sandbox][Domain] Failed to initialize agent', [
                    'sandbox_id' => $sandboxId,
                    'error' => $result->getMessage(),
                    'code' => $result->getCode(),
                ]);
                throw new SandboxOperationException('Initialize agent', $result->getMessage(), $result->getCode());
            }

            if ($interruptChecker !== null && $interruptChecker()) {
                $this->logger->info('[Sandbox][Domain] Interrupted after agent initialization', [
                    'sandbox_id' => $sandboxId,
                    'topic_id' => $topicEntity->getId(),
                ]);
                $assertOwnership();
                $this->assertSandboxRuntime((int) $topicEntity->getProjectId(), $sandboxId, (int) $topicEntity->getId());
                return $sandboxId;
            }

            // Step 4: Wait for workspace ready (with interrupt support)
            $isReady = $this->waitForWorkspaceReady($dataIsolation, $sandboxId, interruptChecker: $interruptChecker);
            if (! $isReady) {
                $this->logger->info('[Sandbox][Domain] Interrupted during workspace ready wait', [
                    'sandbox_id' => $sandboxId,
                    'topic_id' => $topicEntity->getId(),
                ]);
                $assertOwnership();
                $this->assertSandboxRuntime((int) $topicEntity->getProjectId(), $sandboxId, (int) $topicEntity->getId());
                return $sandboxId;
            }

            $this->logger->info('[Sandbox][Domain] Sandbox initialized successfully', [
                'sandbox_id' => $sandboxId,
                'topic_id' => $topicEntity->getId(),
            ]);

            $assertOwnership();
            $this->assertSandboxRuntime((int) $topicEntity->getProjectId(), $sandboxId, (int) $topicEntity->getId());
            return $sandboxId;
        });
    }

    /**
     * 调用沙箱网关，创建沙箱容器，如果 sandboxId 不存在，系统会默认创建一个.
     */
    public function createSandbox(DataIsolation $dataIsolation, string $projectId, string $sandboxID, string $workDir, string $projectSpaceRootFileId = '', string $userSpaceRootFileId = '', string $topicSpaceRootFileId = '', ?int $topicId = null, ?string $agentCode = null, ?SandboxImageTarget $images = null): string
    {
        $claw = di(MagicClawRuntimePolicyDomainService::class)->assertProject((int) $projectId);
        if ($claw !== null && $topicId === null) {
            throw new MagicClawRuntimeDeniedException();
        }
        $create = function () use ($claw, $dataIsolation, $projectId, $sandboxID, $workDir, $projectSpaceRootFileId, $userSpaceRootFileId, $topicSpaceRootFileId, $topicId, $agentCode, $images): string {
            di(MagicClawRuntimePolicyDomainService::class)->assertProject((int) $projectId);
            if ($claw !== null) {
                $topic = $this->topicRepository->getTopicById((int) $topicId);
                if ($topic === null || $topic->getProjectId() !== (int) $projectId) {
                    throw new MagicClawRuntimeDeniedException();
                }
                $this->topicRepository->updateTopicByCondition(['id' => $topicId], ['sandbox_id' => $sandboxID]);
            }
            $id = $this->createSandboxWithinLifecycle($dataIsolation, $projectId, $sandboxID, $workDir, $projectSpaceRootFileId, $userSpaceRootFileId, $topicSpaceRootFileId, $topicId, $agentCode, $images);
            $this->assertSandboxRuntime((int) $projectId, $id, $topicId);
            return $id;
        };
        return $topicId !== null ? di(SandboxLifecycleLock::class)->run($topicId, $create) : $create();
    }

    /**
     * 删除（停止）沙箱.
     *
     * @param string $sandboxId 沙箱ID
     * @return GatewayResult 删除结果
     */
    public function stopSandbox(string $sandboxId): GatewayResult
    {
        $this->logger->debug('[Sandbox][Domain] Stopping sandbox', ['sandbox_id' => $sandboxId]);

        $result = $this->gateway->deleteSandbox($sandboxId);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][Domain] Failed to stop sandbox', [
                'sandbox_id' => $sandboxId,
                'code' => $result->getCode(),
                'message' => $result->getMessage(),
            ]);
            throw new SandboxOperationException('Stop sandbox', $result->getMessage(), $result->getCode());
        }

        $this->logger->info('[Sandbox][Domain] Sandbox stopped successfully', ['sandbox_id' => $sandboxId]);

        return $result;
    }

    /** Shared by explicit cleanup, restart and permission-driven cleanup. */
    public function stopSandboxIfExists(string $sandboxId): GatewayResult
    {
        try {
            return $this->stopSandbox($sandboxId);
        } catch (SandboxOperationException $exception) {
            if (! ResponseCode::isNotFound($exception->getCode())) {
                throw $exception;
            }
            return GatewayResult::success(['sandbox_id' => $sandboxId], 'Sandbox already absent');
        }
    }

    /**
     * 获取沙箱状态
     *
     * @param string $sandboxId 沙箱ID
     * @return SandboxStatusResult 沙箱状态结果
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult
    {
        $this->logger->debug('[Sandbox][App] Getting sandbox status', [
            'sandbox_id' => $sandboxId,
        ]);

        $result = $this->gateway->getSandboxStatus($sandboxId);

        if (! $result->isSuccess() && $result->getCode() !== ResponseCode::NOT_FOUND) {
            $this->logger->error('[Sandbox][App] Failed to get sandbox status', [
                'sandbox_id' => $sandboxId,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            // throw new SandboxOperationException('Get sandbox status', $result->getMessage(), $result->getCode());
        }

        $this->logger->debug('[Sandbox][App] Sandbox status retrieved', [
            'sandbox_id' => $sandboxId,
            'status' => $result->getStatus(),
        ]);

        return $result;
    }

    /** @return array{agent_image: string, agfs_image: string} */
    public function getLatestImages(): array
    {
        return $this->gateway->getLatestImages();
    }

    public function getLatestAgentImage(): string
    {
        return $this->gateway->getLatestAgentImage();
    }

    /**
     * 批量获取沙箱状态
     *
     * @param array $sandboxIds 沙箱ID数组
     * @return BatchStatusResult 批量沙箱状态结果
     */
    public function getBatchSandboxStatus(array $sandboxIds): BatchStatusResult
    {
        $this->logger->debug('[Sandbox][App] Getting batch sandbox status', [
            'sandbox_ids' => $sandboxIds,
            'count' => count($sandboxIds),
        ]);

        $result = $this->gateway->getBatchSandboxStatus($sandboxIds);

        if (! $result->isSuccess() && $result->getCode() !== ResponseCode::NOT_FOUND) {
            $this->logger->error('[Sandbox][App] Failed to get batch sandbox status', [
                'sandbox_ids' => $sandboxIds,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Get batch sandbox status', $result->getMessage(), $result->getCode());
        }

        $this->logger->debug('[Sandbox][App] Batch sandbox status retrieved', [
            'requested_count' => count($sandboxIds),
            'returned_count' => $result->getTotalCount(),
            'running_count' => $result->getRunningCount(),
        ]);

        return $result;
    }

    /**
     * 列出网关里真实存在的沙箱（可按状态过滤）。
     *
     * 与 getBatchSandboxStatus 不同：这里不依赖业务表里的 sandbox_id，直接以网关
     * 的 pod 清单为准，供运维脚本判断“当前哪些沙箱真的在跑”。
     *
     * @param string[] $statuses 只返回这些状态（如 ['Running']）；空数组表示不过滤
     */
    public function listSandboxes(array $statuses = []): SandboxListResult
    {
        $this->logger->info('[Sandbox][Domain] Listing sandboxes from gateway', [
            'statuses' => $statuses,
        ]);

        $result = $this->gateway->listSandboxes($statuses);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][Domain] Failed to list sandboxes', [
                'statuses' => $statuses,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('List sandboxes', $result->getMessage(), $result->getCode());
        }

        $this->logger->info('[Sandbox][Domain] Sandbox list retrieved', [
            'statuses' => $statuses,
            'total' => $result->getTotal(),
            'status_counts' => $result->getStatusCounts(),
        ]);

        return $result;
    }

    /**
     * 发送消息给 agent.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param TaskContext $taskContext 任务上下文
     * @param array<string, mixed> $personalPreferences 当前 CHAT 的个人偏好
     */
    public function sendChatMessage(DataIsolation $dataIsolation, TaskContext $taskContext, array $personalPreferences = []): void
    {
        di(MagicClawRuntimePolicyDomainService::class)->assertTopic($taskContext->getTopicId());
        $taskDynamicConfig = $taskContext->getDynamicConfig();

        if ($taskId = (string) $taskContext->getTask()->getId()) {
            // 添加任意注册到 DynamicConfigManager 的动态配置。暂时通过 TaskId 进行区分。
            $dynamicConfigs = $this->dynamicConfigManager->getByTaskId($taskId);
            foreach ($dynamicConfigs as $key => $dynamicConfig) {
                $taskDynamicConfig[$key] = $dynamicConfig;
            }
        }

        // 图片/视频模型都不走 init 顶层字段，而是跟现有生图链路保持一致，
        // 在发送聊天消息时桥接到 dynamic_config。这样沙箱内的工具只需要读取
        // dynamic_config.image_model / dynamic_config.video_model，就能和用户本轮选择保持一致。
        $extra = $taskContext->getExtra();
        // 思考强度是每条消息的请求参数，不能被任务缓存或任意动态参数覆盖。
        $taskDynamicConfig['reasoning_effort'] = $extra?->getReasoningEffort();
        // Always send both states: omitting true would leave the previous false in
        // the sandbox's dynamic-config snapshot. The message extra is authoritative.
        $taskDynamicConfig['enable_web_search'] = $extra?->getEnableWebSearch() ?? true;
        if ($extra !== null) {
            $imageModelId = $extra->getImageModelId();
            if (! empty($imageModelId)) {
                $sizes = [];
                if ($imageModelVersion = $taskDynamicConfig['image_model_versions'][$imageModelId] ?? null) {
                    $sizes = SizeManager::matchConfig(modelVersion: $imageModelVersion, modelId: $imageModelId)['sizes'] ?? [];
                }

                $taskDynamicConfig['image_model'] = [
                    'model_id' => $imageModelId,
                    'sizes' => $sizes,
                ];
            }

            $videoModelId = $extra->getVideoModelId();
            if (! empty($videoModelId)) {
                try {
                    $videoModel = di(VideoModelConfigResolver::class)->resolve($extra->getVideoModel(), $taskContext->getDataIsolation());
                    $taskDynamicConfig['video_model'] = [
                        'model_id' => $videoModelId,
                        'video_generation_config' => is_array($videoModel) ? $videoModel['video_generation_config'] : null,
                    ];
                } catch (Throwable $throwable) {
                    $this->logger->warning('[Sandbox][App] get video model config failed', [
                        'error_message' => $throwable->getMessage(),
                    ]);
                    $taskDynamicConfig['video_model'] = [
                        'model_id' => $videoModelId,
                    ];
                }
            }
        }

        $agentMode = $taskContext->getAgentMode();
        if (str_starts_with($taskContext->getAgentMode(), 'SMA-')) {
            $agentMode = ProjectMode::CUSTOM_AGENT->value;
            $taskDynamicConfig['agent_code'] = $taskContext->getAgentMode();
        }

        $agentMode = $taskContext->getAgentMode();
        $agentCode = $this->resolveAgentCodeForSandbox($dataIsolation, $agentMode, $taskContext->getAgentCode());
        if (! empty($agentCode)) {
            $taskDynamicConfig['agent_code'] = $agentCode;
        }

        // Build agent profile for chat message (ensures Python side always gets agent info, even for reused sandbox)
        $language = $dataIsolation->getLanguage() ?? 'zh_CN';
        $agentProfile = $this->buildAgentProfile($dataIsolation, $agentMode, $taskContext->getAgentCode(), $language);

        $this->logger->info('[Sandbox][App] Sending chat message to agent', [
            'sandbox_id' => $taskContext->getSandboxId(),
            'task_id' => $taskContext->getTask()->getId(),
            'prompt' => $taskContext->getTask()->getPrompt(),
            'task_mode' => $taskContext->getTask()->getTaskMode(),
            'agent_mode' => $agentMode,
            'mentions' => $taskContext->getTask()->getMentions(),
            'mcp_server_count' => count($taskContext->getMcpConfig()['mcpServers'] ?? []),
            'model_id' => $taskContext->getModelId(),
            'dynamic_config' => $taskDynamicConfig,
            'agent' => $agentProfile,
        ]);
        $mentionsJsonStruct = $this->buildMentionsJsonStruct(
            $taskContext->getTask()->getMentions(),
            $taskContext->getTask()->getProjectId(),
            (string) config('super-magic.agent.referenced_project_mount_base_path', '/mnt/agfs-vol/agfs/magicfs/referenced-projects')
        );

        // Get original prompt
        $userRequest = $taskContext->getTask()->getPrompt();

        // Keep the legacy constraint until all sandboxes consume enable_web_search.
        // New runtimes also inject the current state through Horizon, including on resume.
        $constraintText = $this->getPromptConstraint($taskContext);
        $prompt = $userRequest . $constraintText;

        $superMagicProductContext = $this->buildCurrentSuperMagicProductContext($taskContext);

        // 构建 metadata（使用公共方法）
        $initMetadata = new InitializationMetadataDTO();
        $messageMetadata = $this->buildMessageMetadata(
            dataIsolation: $dataIsolation,
            taskContext: $taskContext,
            initMetadata: $initMetadata,
            personalPreferences: $personalPreferences
        );

        $this->logger->info('[Sandbox][App] Built metadata for chat message', [
            'task_id' => $taskContext->getTask()->getId(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'metadata' => $messageMetadata->toArray(),
        ]);

        // 构建参数
        $chatMessage = ChatMessageRequest::create(
            messageId: $taskContext->getMessageId(),
            userId: $dataIsolation->getCurrentUserId(),
            taskId: (string) $taskContext->getTask()->getId(),
            prompt: $prompt,
            taskMode: $taskContext->getTask()->getTaskMode(),
            agentMode: $agentMode,
            mentions: $mentionsJsonStruct,
            mcpConfig: $taskContext->getMcpConfig(),
            modelId: $taskContext->getModelId(),
            dynamicConfig: $taskDynamicConfig,
            metadata: $messageMetadata->toArray(),
            agent: ! empty($agentProfile) ? $agentProfile : null,
            superMagicProductContext: $superMagicProductContext,
        );

        $result = $this->agent->sendChatMessage($dataIsolation, $taskContext->getSandboxId(), $chatMessage);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to send chat message to agent', [
                'sandbox_id' => $taskContext->getSandboxId(),
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Send chat message', $result->getMessage(), $result->getCode());
        }
    }

    /**
     * 发送 ask_user 答复给沙盒（Human-in-the-Loop 回调）.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param string $sandboxId 沙箱ID
     * @param string $taskId 任务ID
     * @param string $questionId 问题ID
     * @param string $responseStatus 答复状态（'answered' | 'skipped'）
     * @param string $answer 用户答复内容
     */
    public function sendAskUserFeedback(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskId,
        string $questionId,
        string $responseStatus,
        string $answer
    ): void {
        $topic = $this->topicRepository->getTopicBySandboxId($sandboxId);
        if ($topic !== null) {
            di(MagicClawRuntimePolicyDomainService::class)->assertTopic((int) $topic->getId());
        }
        $this->logger->debug('[Sandbox][Domain] Sending ask_user feedback to sandbox', [
            'sandbox_id' => $sandboxId,
            'task_id' => $taskId,
            'question_id' => $questionId,
            'response_status' => $responseStatus,
        ]);

        $request = AskUserResponseMessageRequest::createResponse(
            userId: $dataIsolation->getCurrentUserId(),
            taskId: $taskId,
            questionId: $questionId,
            responseStatus: $responseStatus,
            answer: $answer,
        );

        $result = $this->agent->sendChatMessage($dataIsolation, $sandboxId, $request);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][Domain] Failed to send ask_user feedback', [
                'sandbox_id' => $sandboxId,
                'task_id' => $taskId,
                'question_id' => $questionId,
                'error' => $result->getMessage(),
            ]);
            throw new SandboxOperationException('Send ask_user feedback', $result->getMessage(), $result->getCode());
        }

        $this->logger->debug('[Sandbox][Domain] Ask_user feedback sent successfully', [
            'sandbox_id' => $sandboxId,
            'task_id' => $taskId,
            'question_id' => $questionId,
        ]);
    }

    /**
     * 发送用户工具调用回传给沙盒（Human-in-the-Loop 回调）.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param string $sandboxId 沙箱ID
     * @param string $name 工具名称（如 ask_user、plan）
     * @param string $toolCallId 工具调用ID
     * @param array $detail 工具特定的回复数据，结构由各工具自行约定
     */
    public function sendUserToolCallFeedback(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $name,
        string $toolCallId,
        array $detail
    ): void {
        $topic = $this->topicRepository->getTopicBySandboxId($sandboxId);
        if ($topic !== null) {
            di(MagicClawRuntimePolicyDomainService::class)->assertTopic((int) $topic->getId());
        }
        $this->logger->debug('[Sandbox][Domain] Sending user_tool_call feedback to sandbox', [
            'sandbox_id' => $sandboxId,
            'name' => $name,
            'tool_call_id' => $toolCallId,
        ]);

        $request = UserToolCallFeedbackRequest::createFeedback(
            userId: $dataIsolation->getCurrentUserId(),
            name: $name,
            toolCallId: $toolCallId,
            detail: $detail,
        );

        $result = $this->agent->sendChatMessage($dataIsolation, $sandboxId, $request);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][Domain] Failed to send user_tool_call feedback', [
                'sandbox_id' => $sandboxId,
                'name' => $name,
                'tool_call_id' => $toolCallId,
                'error' => $result->getMessage(),
            ]);
            // 问题已被超时消费或重复提交，属于可预期的业务边界而非沙箱故障，
            // 抛专用异常让上层转换为温和提醒而不是任务错误。
            if (ResponseCode::isUserToolCallNotFound($result->getCode())) {
                throw new UserToolCallNotFoundException($result->getMessage(), $result->getCode());
            }
            if ($name === 'ask_user' && $result->getCode() === ResponseCode::USER_TOOL_CALL_ENVIRONMENT_CLOSING) {
                // 旧环境未消费回答；沿用恢复失败提示与幂等锁释放，不能改成任务 ERROR。
                throw new UserToolCallRecoveryException('The execution environment is closing; the question is still pending.');
            }
            throw new SandboxOperationException('Send user_tool_call feedback', $result->getMessage(), $result->getCode());
        }

        $this->logger->debug('[Sandbox][Domain] user_tool_call feedback sent successfully', [
            'sandbox_id' => $sandboxId,
            'name' => $name,
            'tool_call_id' => $toolCallId,
        ]);
    }

    /**
     * 发送中断消息给Agent.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param string $sandboxId 沙箱ID
     * @param string $taskId 任务ID
     * @param string $reason 中断原因
     * @return AgentResponse 中断响应
     */
    public function sendInterruptMessage(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskId,
        string $reason,
    ): AgentResponse {
        $this->logger->debug('[Sandbox][App] Sending interrupt message to agent', [
            'sandbox_id' => $sandboxId,
            'task_id' => $taskId,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'reason' => $reason,
        ]);

        // 发送中断消息
        $messageId = (string) IdGenerator::getSnowId();
        $interruptRequest = InterruptRequest::create(
            $messageId,
            $dataIsolation->getCurrentUserId(),
            $taskId,
            $reason,
        );

        $response = $this->agent->sendInterruptMessage($dataIsolation, $sandboxId, $interruptRequest);

        if (! $response->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to send interrupt message to agent', [
                'sandbox_id' => $sandboxId,
                'task_id' => $taskId,
                'user_id' => $dataIsolation->getCurrentUserId(),
                'reason' => $reason,
                'error' => $response->getMessage(),
                'code' => $response->getCode(),
            ]);
            throw new SandboxOperationException('Send interrupt message', $response->getMessage(), $response->getCode());
        }

        $this->logger->debug('[Sandbox][App] Interrupt message sent to agent successfully', [
            'sandbox_id' => $sandboxId,
            'task_id' => $taskId,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'reason' => $reason,
        ]);

        return $response;
    }

    /**
     * 获取工作区状态.
     *
     * @param DataIsolation $dataIsolation per-call user identity (token auto-fetched by create())
     * @param string $sandboxId 沙箱ID
     * @return AgentResponse 工作区状态响应
     */
    public function getWorkspaceStatus(DataIsolation $dataIsolation, string $sandboxId): AgentResponse
    {
        $this->logger->debug('[Sandbox][App] Getting workspace status', [
            'sandbox_id' => $sandboxId,
        ]);

        $result = $this->agent->getWorkspaceStatus($dataIsolation, $sandboxId);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to get workspace status', [
                'sandbox_id' => $sandboxId,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Get workspace status', $result->getMessage(), $result->getCode());
        }

        $this->logger->debug('[Sandbox][App] Workspace status retrieved', [
            'sandbox_id' => $sandboxId,
            'status' => $result->getDataValue('status'),
        ]);

        return $result;
    }

    /**
     * Wait for workspace to be ready with optional interrupt check.
     * Polls workspace status until initialization completes, fails, times out, or is interrupted.
     *
     * @param DataIsolation $dataIsolation per-call user identity
     * @param string $sandboxId Sandbox ID
     * @param null|callable $interruptChecker Interrupt checker closure, return true to interrupt
     * @param int $maxWaitSeconds Maximum wait time in seconds (default 5 minutes)
     * @param int $checkIntervalMs Check interval in milliseconds (default 100ms)
     * @return bool True if workspace is ready, false if interrupted
     * @throws WorkspaceReadyTimeoutException When timeout occurs
     * @throws SandboxOperationException When initialization fails or error occurs
     */
    public function waitForWorkspaceReady(
        DataIsolation $dataIsolation,
        string $sandboxId,
        int $maxWaitSeconds = 300,
        int $checkIntervalMs = 100,
        ?callable $interruptChecker = null
    ): bool {
        $this->logger->debug('[Sandbox][App] Waiting for workspace to be ready', [
            'sandbox_id' => $sandboxId,
            'max_wait_seconds' => $maxWaitSeconds,
            'check_interval_ms' => $checkIntervalMs,
            'has_interrupt_checker' => $interruptChecker !== null,
        ]);

        $startTime = time();

        while (true) {
            // 1. First check if interrupted (closure check)
            if ($interruptChecker !== null && $interruptChecker()) {
                $this->logger->info('[Sandbox][App] Workspace ready wait interrupted by checker', [
                    'sandbox_id' => $sandboxId,
                    'elapsed_time' => time() - $startTime,
                ]);
                return false; // Return false to indicate interrupted
            }

            // 2. Check workspace status
            try {
                $response = $this->getWorkspaceStatus($dataIsolation, $sandboxId);
                $status = $response->getDataValue('status');

                $this->logger->debug('[Sandbox][App] Workspace status check', [
                    'sandbox_id' => $sandboxId,
                    'status' => $status,
                    'status_description' => WorkspaceStatus::getDescription($status),
                    'elapsed_seconds' => time() - $startTime,
                ]);

                // Status is ready, return success
                if (WorkspaceStatus::isReady($status)) {
                    $this->logger->debug('[Sandbox][App] Workspace is ready', [
                        'sandbox_id' => $sandboxId,
                        'elapsed_seconds' => time() - $startTime,
                    ]);
                    return true;
                }

                // Status is error, throw exception
                if (WorkspaceStatus::isError($status)) {
                    $this->logger->error('[Sandbox][App] Workspace initialization failed', [
                        'sandbox_id' => $sandboxId,
                        'status' => $status,
                        'status_description' => WorkspaceStatus::getDescription($status),
                        'elapsed_seconds' => time() - $startTime,
                    ]);
                    throw new SandboxOperationException(
                        'Wait for workspace ready',
                        'Workspace initialization failed with status: ' . WorkspaceStatus::getDescription($status),
                        3001
                    );
                }
            } catch (SandboxOperationException $e) {
                // Re-throw sandbox operation exception
                throw $e;
            } catch (Throwable $e) {
                $this->logger->warning('[Sandbox][App] Error while checking workspace status', [
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                    'elapsed_seconds' => time() - $startTime,
                ]);
                // Continue retry, don't throw exception
            }

            // 3. Check timeout
            $elapsedTime = time() - $startTime;
            if ($elapsedTime >= $maxWaitSeconds) {
                $this->logger->error('[Sandbox][App] Workspace ready timeout', [
                    'sandbox_id' => $sandboxId,
                    'max_wait_seconds' => $maxWaitSeconds,
                    'elapsed_time' => $elapsedTime,
                ]);
                throw new WorkspaceReadyTimeoutException(
                    "Workspace not ready after {$maxWaitSeconds} seconds"
                );
            }

            // 4. Wait before retry
            if ($checkIntervalMs > 0) {
                usleep($checkIntervalMs * 1000);
            }
        }
    }

    /**
     * 回滚到指定的checkpoint.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $targetMessageId 目标消息ID
     * @return AgentResponse 回滚响应
     */
    public function rollbackCheckpoint(DataIsolation $dataIsolation, string $sandboxId, string $targetMessageId): AgentResponse
    {
        $this->logger->debug('[Sandbox][Domain] Rolling back to checkpoint', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        try {
            $request = CheckpointRollbackRequest::create($targetMessageId);
            $response = $this->agent->rollbackCheckpoint($dataIsolation, $sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->debug('[Sandbox][Domain] Checkpoint rollback successful', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Domain] Checkpoint rollback failed', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Domain] Unexpected error during checkpoint rollback', [
                'sandbox_id' => $sandboxId,
                'target_message_id' => $targetMessageId,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Rollback checkpoint', 'Checkpoint rollback failed: ' . $e->getMessage(), 3004);
        }
    }

    /**
     * 开始回滚到指定的checkpoint（调用沙箱网关）.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $targetMessageId 目标消息ID
     * @return AgentResponse 回滚响应
     */
    public function rollbackCheckpointStart(DataIsolation $dataIsolation, string $sandboxId, string $targetMessageId): AgentResponse
    {
        $this->logger->debug('[Sandbox][Domain] Starting checkpoint rollback', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        try {
            $request = CheckpointRollbackStartRequest::create($targetMessageId);
            $response = $this->agent->rollbackCheckpointStart($dataIsolation, $sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->debug('[Sandbox][Domain] Checkpoint rollback start successful', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Domain] Checkpoint rollback start failed', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Domain] Unexpected error during checkpoint rollback start', [
                'sandbox_id' => $sandboxId,
                'target_message_id' => $targetMessageId,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Rollback checkpoint start', 'Checkpoint rollback start failed: ' . $e->getMessage(), 3005);
        }
    }

    /**
     * 提交回滚到指定的checkpoint（调用沙箱网关）.
     *
     * @param string $sandboxId 沙箱ID
     * @return AgentResponse 回滚响应
     */
    public function rollbackCheckpointCommit(DataIsolation $dataIsolation, string $sandboxId): AgentResponse
    {
        $this->logger->debug('[Sandbox][Domain] Committing checkpoint rollback', [
            'sandbox_id' => $sandboxId,
        ]);

        try {
            $request = CheckpointRollbackCommitRequest::create();
            $response = $this->agent->rollbackCheckpointCommit($dataIsolation, $sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->debug('[Sandbox][Domain] Checkpoint rollback commit successful', [
                    'sandbox_id' => $sandboxId,
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Domain] Checkpoint rollback commit failed', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Domain] Unexpected error during checkpoint rollback commit', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Rollback checkpoint commit', 'Checkpoint rollback commit failed: ' . $e->getMessage(), 3006);
        }
    }

    /**
     * 撤销回滚沙箱checkpoint（调用沙箱网关）.
     *
     * @param string $sandboxId 沙箱ID
     * @return AgentResponse 回滚响应
     */
    public function rollbackCheckpointUndo(DataIsolation $dataIsolation, string $sandboxId): AgentResponse
    {
        $this->logger->debug('[Sandbox][Domain] Undoing checkpoint rollback', [
            'sandbox_id' => $sandboxId,
        ]);

        try {
            $request = CheckpointRollbackUndoRequest::create();
            $response = $this->agent->rollbackCheckpointUndo($dataIsolation, $sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->debug('[Sandbox][Domain] Checkpoint rollback undo successful', [
                    'sandbox_id' => $sandboxId,
                    'message' => $response->getMessage(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Domain] Checkpoint rollback undo failed', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Domain] Unexpected error during checkpoint rollback undo', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Rollback checkpoint undo', 'Checkpoint rollback undo failed: ' . $e->getMessage(), 3007);
        }
    }

    /**
     * 检查回滚到指定checkpoint的可行性.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $targetMessageId 目标消息ID
     * @return AgentResponse 检查响应
     */
    public function rollbackCheckpointCheck(DataIsolation $dataIsolation, string $sandboxId, string $targetMessageId): AgentResponse
    {
        $this->logger->debug('[Sandbox][Domain] Checking checkpoint rollback feasibility', [
            'sandbox_id' => $sandboxId,
            'target_message_id' => $targetMessageId,
        ]);

        try {
            $request = CheckpointRollbackCheckRequest::create($targetMessageId);
            $response = $this->agent->rollbackCheckpointCheck($dataIsolation, $sandboxId, $request);

            if ($response->isSuccess()) {
                $this->logger->debug('[Sandbox][Domain] Checkpoint rollback check completed', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'can_rollback' => $response->getDataValue('can_rollback'),
                ]);
            } else {
                $this->logger->warning('[Sandbox][Domain] Checkpoint rollback check failed', [
                    'sandbox_id' => $sandboxId,
                    'target_message_id' => $targetMessageId,
                    'error' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Domain] Unexpected error during checkpoint rollback check', [
                'sandbox_id' => $sandboxId,
                'target_message_id' => $targetMessageId,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Rollback checkpoint check', 'Checkpoint rollback check failed: ' . $e->getMessage(), 3008);
        }
    }

    /**
     * Ensure sandbox container is running (without agent initialization).
     * Used for export/utility scenarios that only need the sandbox container running.
     *
     * @param DataIsolation $dataIsolation per-call user identity (token auto-fetched by create())
     * @param string $sandboxId Sandbox ID
     * @param string $projectId Project ID
     * @param string $workDir Working directory
     * @return string The actual sandbox ID
     * @throws SandboxOperationException When sandbox cannot be started
     */
    public function ensureSandboxRunning(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $projectId,
        string $workDir,
        string $projectSpaceRootFileId = '',
        string $topicSpaceRootFileId = ''
    ): string {
        $claw = di(MagicClawRuntimePolicyDomainService::class)->assertProject((int) $projectId);
        if ($claw === null) {
            return $this->ensureSandboxContainerRunning($dataIsolation, $sandboxId, $projectId, $workDir, $projectSpaceRootFileId, $topicSpaceRootFileId);
        }
        // Auxiliary conversion containers do not own a topic. Negative project IDs use a disjoint lock namespace.
        return di(SandboxLifecycleLock::class)->run(-((int) $projectId), function (callable $guard) use ($claw, $dataIsolation, $sandboxId, $projectId, $workDir, $projectSpaceRootFileId, $topicSpaceRootFileId): string {
            $guard();
            di(MagicClawRuntimePolicyDomainService::class)->assertProject((int) $projectId);
            di(MagicClawReconciliationRepository::class)->bindConverter((int) $claw->getId(), $sandboxId);
            $id = $this->ensureSandboxContainerRunning($dataIsolation, $sandboxId, $projectId, $workDir, $projectSpaceRootFileId, $topicSpaceRootFileId, fn (string $createdId) => di(MagicClawReconciliationRepository::class)->bindConverter((int) $claw->getId(), $createdId));
            di(MagicClawReconciliationRepository::class)->bindConverter((int) $claw->getId(), $id);
            $guard();
            $this->assertSandboxRuntime((int) $projectId, $id);
            return $id;
        });
    }

    /**
     * 根据用户ID获取 Authorization.
     * - 先以用户级别 token（MagicTokenType::User）为准，支持一个账号多个组织
     * - 若 token 已存在但剩余有效期不足 29 天，则刷新至 30 天后.
     *
     * @param string $userId 用户ID
     * @return string Authorization 字符串，如果不存在则返回空字符串
     */
    public function getAuthorizationByUserId(string $userId): string
    {
        // 先按 MagicTokenType::User + userId 查询是否有可用的 token
        $tokenEntity = $this->magicTokenRepository->getTokenByTypeAndRelationValue(MagicTokenType::User, $userId);

        // 如果已存在可用的 token，根据有效期情况刷新后返回
        if ($tokenEntity !== null) {
            $this->refreshTokenExpirationIfNeeded($tokenEntity);
            return $tokenEntity->getToken();
        }

        // 如果没有可用的 token，创建一个新的 token（有效期一个月）
        try {
            $newToken = IdGenerator::getUniqueIdSha256();
            $magicTokenEntity = new MagicTokenEntity();
            $magicTokenEntity->setType(MagicTokenType::User);
            $magicTokenEntity->setTypeRelationValue($userId);
            $magicTokenEntity->setToken($newToken);
            // 设置有效期为30天
            $expiredAt = Carbon::now()->addDays(30)->toDateTimeString();
            $magicTokenEntity->setExpiredAt($expiredAt);

            $this->magicTokenRepository->createToken($magicTokenEntity);

            return $newToken;
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][App] Failed to create user token', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            return '';
        }
    }

    /**
     * Mount referenced projects (cross-project @mentions) into the sandbox
     * as a read-only space. Access control is the caller's responsibility —
     * this method assumes the caller has already verified the user can access
     * every target project.
     *
     * @param string[] $projectIds
     * @throws RuntimeException when any mount fails
     */
    public function mountReferencedProjects(
        DataIsolation $dataIsolation,
        string $sandboxId,
        array $projectIds,
        array $projectRootFileIds = []
    ): void {
        if (empty($projectIds)) {
            return;
        }

        foreach ($projectIds as $projectId) {
            $this->mountSingleReferencedProject($dataIsolation, $sandboxId, $projectId, (string) ($projectRootFileIds[(int) $projectId] ?? $projectRootFileIds[$projectId] ?? ''));
        }
    }

    private function createSandboxWithinLifecycle(DataIsolation $dataIsolation, string $projectId, string $sandboxID, string $workDir, string $projectSpaceRootFileId = '', string $userSpaceRootFileId = '', string $topicSpaceRootFileId = '', ?int $topicId = null, ?string $agentCode = null, ?SandboxImageTarget $images = null): string
    {
        di(MagicClawRuntimePolicyDomainService::class)->assertProject((int) $projectId);
        $this->logger->debug('[Sandbox][App] Creating sandbox', [
            'project_id' => $projectId,
            'sandbox_id' => $sandboxID,
            'project_oss_path' => $workDir,
            'project_space_root_file_id' => $projectSpaceRootFileId,
            'user_space_root_file_id' => $userSpaceRootFileId,
            'topic_space_root_file_id' => $topicSpaceRootFileId,
            'authorization_provided' => $dataIsolation->getUserAuthorizationToken() !== null && $dataIsolation->getUserAuthorizationToken() !== '',
            'images' => $images?->describe() ?? 'follow gateway release',
        ]);

        // Stamp the topic id onto the pod labels so the sandbox can be
        // correlated back to its topic (warm pool stamps it at mount time).
        $labels = $topicId !== null ? ['topic-id' => (string) $topicId] : [];
        // Also stamp agent code so both custom-agent and magic-claw sandboxes
        // can be correlated back to the original agent identity.
        if ($agentCode !== null && $agentCode !== '') {
            $labels['agent-code'] = $agentCode;
        }
        $result = $this->gateway->createSandbox($dataIsolation, $projectId, $sandboxID, $workDir, $projectSpaceRootFileId, $userSpaceRootFileId, $topicSpaceRootFileId, $labels, $images);

        // 添加详细的调试日志，检查 result 对象
        $this->logger->debug('[Sandbox][App] Gateway result analysis', [
            'result_class' => get_class($result),
            'result_is_success' => $result->isSuccess(),
            'result_code' => $result->getCode(),
            'result_message' => $result->getMessage(),
            'result_data_raw' => $result->getData(),
            'result_data_type' => gettype($result->getData()),
            'sandbox_id_via_getDataValue' => $result->getDataValue('sandbox_id'),
            'sandbox_id_via_getData_direct' => $result->getData()['sandbox_id'] ?? 'KEY_NOT_FOUND',
        ]);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to create sandbox', [
                'project_id' => $projectId,
                'sandbox_id' => $sandboxID,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Create sandbox', $result->getMessage(), $result->getCode());
        }

        $returnedSandboxId = $result->getDataValue('sandbox_id');
        $agentImage = $result->getDataValue('agent_image');
        $agentImage = is_string($agentImage) ? $agentImage : '';

        $this->logger->info('[Sandbox][App] Create sandbox success', [
            'project_id' => $projectId,
            'input_sandbox_id' => $sandboxID,
            'returned_sandbox_id' => $returnedSandboxId,
            'agent_image' => $agentImage,
        ]);

        // 创建成功后立即持久化 sandbox id 与响应中的双镜像。优先使用调用方传入的 topic id，
        // 避免自定义 sandbox_id 场景把 sandbox_id 误当成 topic_id。
        $topicUpdateId = $topicId ?? ((string) (int) $returnedSandboxId === (string) $returnedSandboxId ? (int) $returnedSandboxId : 0);
        if ($topicUpdateId > 0) {
            $topicUpdateData = [
                'sandbox_images' => $result->getSandboxImages(),
                'updated_uid' => $dataIsolation->getCurrentUserId(),
                'updated_at' => date('Y-m-d H:i:s'),
            ];
            if (! empty($returnedSandboxId)) {
                $topicUpdateData['sandbox_id'] = (string) $returnedSandboxId;
            }
            if (! empty($agentImage)) {
                // Keep the legacy column populated for old readers only;
                // sandbox_images is the canonical field for new consumers.
                $topicUpdateData['agent_image'] = $agentImage;
            }
            if (isset($topicUpdateData['sandbox_id']) || isset($topicUpdateData['agent_image'])) {
                $this->topicRepository->updateTopicByCondition(['id' => $topicUpdateId], $topicUpdateData);
            }
        }

        return $returnedSandboxId;
    }

    private function assertSandboxRuntime(int $projectId, string $sandboxId, ?int $topicId = null): void
    {
        try {
            di(MagicClawRuntimePolicyDomainService::class)->assertProject($projectId);
        } catch (MagicClawRuntimeDeniedException $denied) {
            // Keep the binding if deletion cannot be confirmed; the durable reconciler will retry it.
            $claw = $this->magicClawRepository->getByProjectId($projectId);
            if ($claw !== null) {
                di(MagicClawReconciliationRepository::class)->recordRuntimeDenial($claw, $topicId ?? 0, $sandboxId);
            }
            try {
                $this->stopSandboxIfExists($sandboxId);
                if ($topicId !== null) {
                    $this->topicRepository->updateTopicByCondition(['id' => $topicId, 'sandbox_id' => $sandboxId], ['sandbox_id' => '']);
                } elseif ($claw !== null) {
                    di(MagicClawReconciliationRepository::class)->clearConverter((int) $claw->getId(), $sandboxId);
                }
            } catch (Throwable $cleanupError) {
                $this->logger->warning('撤权后的新沙箱清理未确认', ['sandbox_id' => $sandboxId, 'error' => $cleanupError->getMessage()]);
            }
            throw $denied;
        }
    }

    private function ensureSandboxContainerRunning(DataIsolation $dataIsolation, string $sandboxId, string $projectId, string $workDir, string $projectSpaceRootFileId, string $topicSpaceRootFileId, ?callable $onCreated = null): string
    {
        $userId = $dataIsolation->getCurrentUserId();
        $this->logger->debug('[Sandbox][Domain] Ensuring sandbox container is running', [
            'sandbox_id' => $sandboxId,
            'project_id' => $projectId,
            'user_id' => $userId,
        ]);

        // Check if sandbox already running
        $statusResult = $this->getSandboxStatus($sandboxId);
        if ($statusResult->isSuccess() && $statusResult->getCode() === ResponseCode::SUCCESS) {
            if (SandboxStatus::isAvailable($statusResult->getStatus())) {
                $this->logger->debug('[Sandbox][Domain] Sandbox container is already running', [
                    'sandbox_id' => $sandboxId,
                ]);
                return $sandboxId;
            }

            // If Pending, wait for it to become Running
            if ($statusResult->getStatus() === SandboxStatus::PENDING) {
                $this->logger->debug('[Sandbox][Domain] Sandbox container is pending, waiting for it to become running', [
                    'sandbox_id' => $sandboxId,
                ]);
                try {
                    return $this->waitForSandboxContainerRunning($sandboxId, 'existing');
                } catch (SandboxOperationException $e) {
                    $this->logger->warning('[Sandbox][Domain] Failed to wait for existing sandbox container, will recreate', [
                        'sandbox_id' => $sandboxId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        // Create sandbox container. Per-call user identity flows through
        // as a DataIsolation value object – the gateway forwards the
        // authorization token on the HTTP request so the in-pod
        // agfs-server / super-magic agent auth middleware can validate it.
        $createResult = $this->gateway->createSandbox($dataIsolation, $projectId, $sandboxId, $workDir, $projectSpaceRootFileId, '', $topicSpaceRootFileId);

        if (! $createResult->isSuccess()) {
            $this->logger->error('[Sandbox][Domain] Failed to create sandbox container', [
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
                'code' => $createResult->getCode(),
                'message' => $createResult->getMessage(),
            ]);
            throw new SandboxOperationException('Create sandbox', $createResult->getMessage(), $createResult->getCode());
        }

        $newSandboxId = $createResult->getDataValue('sandbox_id');
        if (empty($newSandboxId)) {
            $this->logger->error('[Sandbox][Domain] Failed to get sandbox_id from create result', [
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
            ]);
            throw new SandboxOperationException('Get sandbox_id from create result', 'Failed to get sandbox_id from create result', 2001);
        }

        // Persist the actual gateway ID before readiness waiting can time out.
        if ($onCreated !== null) {
            $onCreated((string) $newSandboxId);
        }
        $this->logger->debug('[Sandbox][Domain] Sandbox container created, waiting for it to become running', [
            'sandbox_id' => $newSandboxId,
        ]);
        return $this->waitForSandboxContainerRunning($newSandboxId, 'new');
    }

    /**
     * 话题换绑后，尽力停掉被替换的旧沙箱。
     *
     * 换绑只是 UPDATE topics.sandbox_id 这一条 SQL，改的是 MySQL 里的指针，
     * K8s 里的旧 pod 收不到任何通知：
     *
     *     换绑前:  topics.sandbox_id = 'A'      pod A  Running
     *     换绑后:  topics.sandbox_id = 'B'      pod A  Running   <- SQL 不停它
     *                                                pod B  Running
     *     本方法:  gateway.delete('A')  ==>     pod A  消失, 只剩 B
     *
     * 若缺了"补一刀"，pod A 就带着同样的 topic-id / agent-code 标签继续
     * Running，从此无人认领——这是"同 topic-id 多个沙箱"问题的直接成因。
     *
     * 尽力而为：旧沙箱可能已被其他流程删除（NOT_FOUND），或停止失败，
     * 都只记日志，绝不影响新沙箱的初始化。
     */
    private function releaseReplacedSandbox(string $previousSandboxId, string $newSandboxId, int $topicId): void
    {
        if ($previousSandboxId === '' || $previousSandboxId === $newSandboxId) {
            return;
        }

        try {
            $this->stopSandbox($previousSandboxId);
            $this->logger->info('[Sandbox][Domain] Stopped sandbox replaced by new binding', [
                'topic_id' => $topicId,
                'old_sandbox_id' => $previousSandboxId,
                'new_sandbox_id' => $newSandboxId,
            ]);
        } catch (Throwable $e) {
            $this->logger->info('[Sandbox][Domain] Skip stopping replaced sandbox', [
                'topic_id' => $topicId,
                'old_sandbox_id' => $previousSandboxId,
                'new_sandbox_id' => $newSandboxId,
                'reason' => $e->getMessage(),
            ]);
        }
    }

    private function refreshInitContextSandboxId(AgentContext $agentContext, string $sandboxId): void
    {
        $initContext = $agentContext->getInitContext();
        if ($initContext === null) {
            return;
        }

        $metadata = $initContext->getMetadata();
        $metadata['sandbox_id'] = $sandboxId;
        $initContext->setMetadata($metadata);

        $initContext->setSuperMagicProductContext(
            $initContext->getSuperMagicProductContext()->withSandboxId($sandboxId)
        );
    }

    private function buildCurrentSuperMagicProductContext(TaskContext $taskContext): SuperMagicProductContext
    {
        $topicEntity = $this->topicRepository->getTopicById($taskContext->getTopicId());
        if ($topicEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        if ($topicEntity->getProjectId() !== $taskContext->getProjectId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        $projectEntity = $this->projectRepository->findById($taskContext->getProjectId());
        if ($projectEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        return $this->buildSuperMagicProductContext(
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            sandboxId: $taskContext->getSandboxId(),
        );
    }

    private function buildSuperMagicProductContext(
        ProjectEntity $projectEntity,
        TopicEntity $topicEntity,
        string $sandboxId,
    ): SuperMagicProductContext {
        if ($topicEntity->getProjectId() !== $projectEntity->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        if ($sandboxId === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_id is required');
        }

        $workspaceEntity = null;
        $workspaceId = $projectEntity->getWorkspaceId();
        if ($workspaceId !== null) {
            $workspaceEntity = $this->workspaceRepository->getWorkspaceById($workspaceId);
            if ($workspaceEntity === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.workspace_not_found');
            }
        }

        return SuperMagicProductContext::fromEntities(
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            workspaceEntity: $workspaceEntity,
            sandboxId: $sandboxId,
        );
    }

    /**
     * Wait for sandbox container to become running.
     *
     * @param string $sandboxId Sandbox ID
     * @param string $type Type for logging ('existing' or 'new')
     * @return string Sandbox ID on success
     * @throws SandboxOperationException When timeout or sandbox exits unexpectedly
     */
    private function waitForSandboxContainerRunning(string $sandboxId, string $type): string
    {
        $maxRetries = 15;
        $retryDelay = 2;

        $this->logger->debug(sprintf('[Sandbox][Domain] Waiting for %s sandbox container to become running', $type), [
            'sandbox_id' => $sandboxId,
            'max_retries' => $maxRetries,
            'retry_delay' => $retryDelay,
        ]);

        for ($i = 0; $i < $maxRetries; ++$i) {
            $statusResult = $this->getSandboxStatus($sandboxId);

            if ($statusResult->isSuccess() && SandboxStatus::isAvailable($statusResult->getStatus())) {
                $this->logger->debug(sprintf('[Sandbox][Domain] %s sandbox container is now running', ucfirst($type)), [
                    'sandbox_id' => $sandboxId,
                    'attempts' => $i + 1,
                ]);
                return $sandboxId;
            }

            if ($type === 'existing' && $statusResult->getStatus() === SandboxStatus::EXITED) {
                $this->logger->debug('[Sandbox][Domain] Existing sandbox container exited while waiting', [
                    'sandbox_id' => $sandboxId,
                    'current_status' => $statusResult->getStatus(),
                ]);
                throw new SandboxOperationException('Wait for existing sandbox', 'Existing sandbox exited while waiting', 2002);
            }

            $this->logger->debug(sprintf('[Sandbox][Domain] Waiting for %s sandbox container...', $type), [
                'sandbox_id' => $sandboxId,
                'current_status' => $statusResult->getStatus(),
                'attempt' => $i + 1,
            ]);
            sleep($retryDelay);
        }

        $this->logger->error(sprintf('[Sandbox][Domain] Timeout waiting for %s sandbox container to become running', $type), [
            'sandbox_id' => $sandboxId,
        ]);
        throw new SandboxOperationException('Wait for sandbox ready', sprintf('Timeout waiting for %s sandbox to become running', $type), 2003);
    }

    /**
     * Try to fulfil the sandbox request from the warm pool. Returns the
     * bound sandbox_id on success, or null when the warm path is not
     * applicable / unavailable so the caller falls back to cold create.
     *
     * Topic side-effects (sandbox_id + recorded images) are persisted
     * here so that the caller doesn't need to know whether the warm or
     * cold path was taken.
     */
    private function tryWarmPoolFastPath(
        DataIsolation $dataIsolation,
        AgentContext $agentContext,
        string $projectSpaceRootFileId,
        string $userSpaceRootFileId,
        string $topicSpaceRootFileId = '',
        ?SandboxImageTarget $images = null
    ): ?string {
        $topicEntity = $agentContext->getTopicEntity();

        // The warm path is opt-in via config until it has soaked in prod.
        if (! (bool) config('super-magic.warm_pool.enabled', false)) {
            return null;
        }

        // Optional per-user allowlist kill switch. When set (non-empty), only
        // the listed user ids are routed through the warm pool; everyone else
        // falls back to the cold create path. Empty list means no restriction.
        $allowedUserIds = (array) config('super-magic.warm_pool.allowed_user_ids', []);
        if (
            ! empty($allowedUserIds)
            && ! in_array($dataIsolation->getCurrentUserId(), $allowedUserIds, true)
        ) {
            $this->logger->info('[Sandbox][WarmPath] Skipping warm pool: user not in allowlist', [
                'user_id' => $dataIsolation->getCurrentUserId(),
                'topic_id' => $topicEntity->getId(),
            ]);
            return null;
        }

        // If the caller pinned a specific sandbox id (e.g. reconnect into an
        // already-existing pod) we must respect that — the warm pool only
        // serves the "create me anything that runs the latest image" case.
        if (! empty($agentContext->getSandboxId())) {
            return null;
        }

        // The warm sandbox mount endpoint requires a project-space root.
        if ($projectSpaceRootFileId === '') {
            $this->logger->info('[Sandbox][WarmPath] Skipping warm pool: missing project root_file_id', [
                'topic_id' => $topicEntity->getId(),
                'project_id' => $agentContext->getProjectEntity()->getId(),
            ]);
            return null;
        }

        $authorization = $dataIsolation->getUserAuthorizationToken() ?? '';
        if ($authorization === '') {
            $this->logger->warning('[Sandbox][WarmPath] Skipping warm pool: no authorization for user', [
                'user_id' => $dataIsolation->getCurrentUserId(),
                'topic_id' => $topicEntity->getId(),
            ]);
            return null;
        }

        $sandboxImages = null;
        try {
            $sandboxId = $this->getWarmPoolSandboxDomainService()->tryAcquireAndMount(
                dataIsolation: $dataIsolation,
                projectId: (string) $agentContext->getProjectEntity()->getId(),
                projectSpaceRootFileId: $projectSpaceRootFileId,
                userSpaceRootFileId: $userSpaceRootFileId,
                topicSpaceRootFileId: $topicSpaceRootFileId,
                labels: $this->buildSandboxLabels($topicEntity),
                topicId: (string) $topicEntity->getId(),
                sandboxImages: $sandboxImages,
                images: $images
            );
        } catch (Throwable $e) {
            // Fall back to the cold path on any unexpected error.
            $this->logger->error('[Sandbox][WarmPath] Warm pool acquire/mount threw, falling back to cold path', [
                'topic_id' => $topicEntity->getId(),
                'error' => $e->getMessage(),
            ]);
            return null;
        }

        if ($sandboxId === null) {
            return null;
        }

        // Persist the binding and response images together. A new binding with
        // incomplete images must not inherit the previous sandbox's version.
        try {
            $topicUpdateData = [
                'sandbox_id' => $sandboxId,
                'sandbox_images' => $sandboxImages,
                'updated_uid' => $dataIsolation->getCurrentUserId(),
                'updated_at' => date('Y-m-d H:i:s'),
            ];
            if ($sandboxImages !== null) {
                // Backward compatibility for old readers; new code must use
                // the complete sandbox_images pair above.
                $topicUpdateData['agent_image'] = $sandboxImages['agent_image'];
            }
            $this->topicRepository->updateTopicByCondition(
                ['id' => (int) $topicEntity->getId()],
                $topicUpdateData
            );
        } catch (Throwable $e) {
            $this->logger->warning('[Sandbox][WarmPath] Failed to stamp topic with warm sandbox metadata', [
                'topic_id' => $topicEntity->getId(),
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
        }

        $this->logger->info('[Sandbox][WarmPath] Warm pool fast path succeeded', [
            'topic_id' => $topicEntity->getId(),
            'sandbox_id' => $sandboxId,
        ]);

        return $sandboxId;
    }

    /**
     * Lazily resolve {@see WarmPoolSandboxDomainService} via the container
     * instead of constructor-injecting it.
     *
     * - Avoids growing this already-large ctor dependency graph and any
     *   construct-time cycle risk if the warm-pool service later picks up
     *   a dep that transitively touches AgentDomainService.
     * - Keeps warm-pool wiring fully unpaid when the feature flag is off
     *   ({@see tryWarmPoolFastPath} early-returns before reaching here).
     *
     * The explicit return type also keeps PHPStan / IDE-level static
     * analysis sharp on the resulting {@see ::tryAcquireAndMount()} call.
     */
    private function getWarmPoolSandboxDomainService(): WarmPoolSandboxDomainService
    {
        return di(WarmPoolSandboxDomainService::class);
    }

    /**
     * Lazily resolve {@see TopicDomainService} via the container instead of
     * constructor-injecting it. Same rationale as
     * {@see getWarmPoolSandboxDomainService()} — avoids growing the ctor
     * graph and keeps the dependency unpaid when the warm path is off.
     */
    private function getTopicDomainService(): \App\Domain\SuperMagic\Topic\Service\TopicDomainService
    {
        return di(\App\Domain\SuperMagic\Topic\Service\TopicDomainService::class);
    }

    /**
     * 构建消息元数据
     * 公共方法，用于 chat 消息复用.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param TaskContext $taskContext 任务上下文
     * @param InitializationMetadataDTO $initMetadata 初始化元数据（必需）
     * @param array<string, mixed> $personalPreferences 当前 CHAT 的个人偏好
     * @return MessageMetadata 消息元数据对象
     */
    private function buildMessageMetadata(
        DataIsolation $dataIsolation,
        TaskContext $taskContext,
        InitializationMetadataDTO $initMetadata,
        array $personalPreferences
    ): MessageMetadata {
        // 获取用户信息
        $userInfoArray = $this->userInfoAppService->getUserInfo($dataIsolation->getCurrentUserId(), $dataIsolation);
        $userInfo = UserInfoValueObject::fromArray($userInfoArray);

        $this->logger->info('[Sandbox][App] Building message metadata', [
            'user_id' => $dataIsolation->getCurrentUserId(),
            'task_id' => $taskContext->getTask()->getId(),
            'language' => $dataIsolation->getLanguage(),
        ]);

        // 从 DataIsolation 获取 authorization（由 create() 自动填充）
        $authorization = $dataIsolation->getUserAuthorizationToken() ?? '';

        // 构建并返回 MessageMetadata 对象
        return new MessageMetadata(
            $taskContext->getAgentUserId(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            $taskContext->getChatConversationId(),
            $taskContext->getChatTopicId(),
            (string) $taskContext->getTopicId(),
            $taskContext->getInstruction()->value,
            $taskContext->getSandboxId(),
            (string) $taskContext->getTask()->getId(),
            $taskContext->getWorkspaceId(),
            (string) $taskContext->getTask()->getProjectId(),
            $dataIsolation->getLanguage() ?? '',
            $initMetadata->getAuthorization() ?? $authorization,
            $userInfo,
            $initMetadata->getSkipInitMessages() ?? false,
            personalPreferences: $personalPreferences
        );
    }

    /**
     * Build the pod labels for a topic's sandbox.
     * Always stamps topic-id; when topic.agent_code is present it also stamps
     * agent-code so sandboxes can be correlated back to the original agent.
     *
     * @return array<string, string>
     */
    private function buildSandboxLabels(TopicEntity $topicEntity): array
    {
        $labels = ['topic-id' => (string) $topicEntity->getId()];

        $agentCode = $this->resolveAgentCodeLabel($topicEntity);
        if ($agentCode !== null) {
            $labels['agent-code'] = $agentCode;
        }

        return $labels;
    }

    /**
     * Resolve sanitized topic agent_code for pod labels, or null when absent.
     *
     * The raw code is sanitized to a valid k8s label value before being
     * returned so that an out-of-spec code can never break sandbox creation.
     */
    private function resolveAgentCodeLabel(TopicEntity $topicEntity): ?string
    {
        $agentCode = $topicEntity->getAgentCode();
        if ($agentCode === '') {
            return null;
        }

        $sanitized = $this->sanitizeLabelValue($agentCode);
        if ($sanitized === '') {
            // Nothing salvageable — skip the label rather than fail the pod.
            $this->logger->warning('[Sandbox][Domain] Agent code is not a valid k8s label value, skipping label', [
                'topic_id' => $topicEntity->getId(),
                'agent_code' => $agentCode,
            ]);
            return null;
        }

        return $sanitized;
    }

    /**
     * Coerce an arbitrary string into a valid Kubernetes label value.
     *
     * k8s label values must be empty or match
     * (([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9]) and be at most 63 chars:
     *   - allowed chars: alphanumerics, '-', '_', '.'
     *   - must start and end with an alphanumeric
     *   - max length 63
     *
     * Any disallowed character is replaced with '-'; the result is truncated
     * to 63 chars and stripped of leading/trailing non-alphanumerics. Returns
     * '' when nothing can be salvaged.
     */
    private function sanitizeLabelValue(string $value): string
    {
        // Replace any character outside the allowed set with '-'.
        $value = preg_replace('/[^A-Za-z0-9\-_.]/', '-', $value) ?? '';
        // Enforce the 63-char cap before trimming so a trailing separator
        // introduced by truncation gets stripped below.
        $value = substr($value, 0, 63);
        // Must start and end with an alphanumeric.
        return trim($value, '-_.');
    }

    /**
     * Resolve agent_code for sandbox based on agent mode.
     * For magiclaw mode, maps the agent_code to the claw entity's template code.
     */
    private function resolveAgentCodeForSandbox(DataIsolation $dataIsolation, string $agentMode, string $agentCode): string
    {
        if ($agentMode !== ProjectMode::MAGICLAW->value || empty($agentCode)) {
            return $agentCode;
        }

        $magicClawEntity = $this->magicClawRepository->findByCode(
            $agentCode,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
        );

        if ($magicClawEntity !== null && $magicClawEntity->getTemplateCode() !== '') {
            return $magicClawEntity->getTemplateCode();
        }

        return $agentCode;
    }

    /**
     * Build agent profile based on agent mode and code.
     * Dispatches to specific profile builders per mode type.
     * Returns array format: {type, profile: {code, name, description, [role], [template_code]}}.
     */
    private function buildAgentProfile(DataIsolation $dataIsolation, string $agentMode, string $agentCode, string $language): array
    {
        if (empty($agentMode)) {
            return [];
        }

        return match ($agentMode) {
            ProjectMode::MAGICLAW->value => $this->buildMagicClawProfile($dataIsolation, $agentCode),
            ProjectMode::CUSTOM_AGENT->value => $this->buildCustomAgentProfile($dataIsolation, $agentCode, $language),
            // micro-app is backed by the built-in micro-app.agent file. Its localized
            // profile is supplied by the Python runtime, not the digital employee table.
            ProjectMode::MICRO_APP->value => [],
            default => $this->buildOfficialAgentProfile($agentMode, $language),
        };
    }

    /**
     * Build profile from magic_super_magic_claw table.
     */
    private function buildMagicClawProfile(DataIsolation $dataIsolation, string $agentCode): array
    {
        $entity = $this->magicClawRepository->findByCode(
            $agentCode,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
        );

        if ($entity === null) {
            return [];
        }

        return [
            'type' => ProjectMode::MAGICLAW->value,
            'profile' => [
                'code' => $entity->getCode(),
                'name' => $entity->getName(),
                'user_facing_name' => $entity->getName(),
                'description' => $entity->getDescription(),
                'template_code' => $entity->getTemplateCode(),
            ],
        ];
    }

    /**
     * Build profile from magic_super_magic_agents table using official organization code as default fallback.
     */
    private function buildOfficialAgentProfile(string $agentCode, string $language): array
    {
        $officialOrgCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if (empty($officialOrgCode)) {
            return [];
        }

        $agentDataIsolation = SuperMagicAgentDataIsolation::create($officialOrgCode);
        $entity = $this->superMagicAgentRepository->getByCode($agentDataIsolation, $agentCode);

        if ($entity === null) {
            return [];
        }

        return [
            'type' => 'official',
            'profile' => [
                'code' => $entity->getCode(),
                'name' => $entity->getI18nName($language),
                'user_facing_name' => $entity->getI18nName($language),
                'description' => $entity->getI18nDescription($language),
            ],
        ];
    }

    /**
     * Build profile from magic_super_magic_agents table.
     */
    private function buildCustomAgentProfile(DataIsolation $dataIsolation, string $agentCode, string $language): array
    {
        $agentDataIsolation = SuperMagicAgentDataIsolation::create(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        );

        $entity = $this->superMagicAgentRepository->getByCode($agentDataIsolation, $agentCode);

        if ($entity === null) {
            return [];
        }

        return [
            'type' => ProjectMode::CUSTOM_AGENT->value,
            'profile' => [
                'code' => $entity->getCode(),
                'name' => $entity->getI18nName($language),
                'user_facing_name' => $entity->getI18nName($language),
                'description' => $entity->getI18nDescription($language),
                'role' => $entity->getI18nRole($language),
            ],
        ];
    }

    /**
     * Get prompt constraint text based on extra configuration.
     * Returns combined constraint text based on extra settings.
     *
     * @param TaskContext $taskContext Task context containing extra and language info
     * @return string Constraint text or empty string
     */
    private function getPromptConstraint(TaskContext $taskContext): string
    {
        $extra = $taskContext->getExtra();
        if ($extra === null) {
            return '';
        }

        $language = $taskContext->getDataIsolation()->getLanguage();
        $constraints = [];

        // Check web search constraint
        if ($extra->getEnableWebSearch() === false) {
            $constraints[] = trans('prompt.disable_web_search_constraint', [], $language);
            $this->logger->debug('[Sandbox][App] Web search disabled, constraint text will be appended to prompt', [
                'task_id' => $taskContext->getTask()->getId(),
                'language' => $language,
            ]);
        }

        return empty($constraints) ? '' : implode('', $constraints);
    }

    /**
     * 当用户 token 剩余有效期不足 29 天时，统一刷新到 30 天后以减少重复签发.
     *
     * @param MagicTokenEntity $tokenEntity 已存在的用户 token
     */
    private function refreshTokenExpirationIfNeeded(MagicTokenEntity $tokenEntity): void
    {
        $now = Carbon::now();
        $renewalThreshold = $now->copy()->addDays(29);
        $expiredAt = Carbon::parse($tokenEntity->getExpiredAt());

        if ($expiredAt->greaterThanOrEqualTo($renewalThreshold)) {
            return;
        }

        $tokenEntity->setExpiredAt($now->copy()->addDays(30)->toDateTimeString());
        $tokenEntity->setUpdatedAt($now->toDateTimeString());
        $this->magicTokenRepository->refreshTokenExpiration($tokenEntity);
    }

    /**
     * @param null|string $mentionsJson mentions 的 JSON 字符串
     * @param null|int $currentProjectId 当前 task 所属项目 ID（同项目 mention 不做路径转换）
     * @param string $mountBasePath 跨项目引用挂载的容器内基础路径（来自 env AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH）
     * @return array 处理后的 mentions 数组
     */
    private function buildMentionsJsonStruct(
        ?string $mentionsJson,
        ?int $currentProjectId,
        string $mountBasePath
    ): array {
        if ($mentionsJson && json_validate($mentionsJson)) {
            $mentions = (array) Json::decode($mentionsJson);
        } else {
            $mentions = [];
        }

        return $this->crossProjectMentionPathTranslator->translate(
            $mentions,
            $currentProjectId,
            $mountBasePath
        );
    }

    /**
     * Mount a single referenced project. Resolves the root file ID and calls
     * the sandbox gateway.
     */
    private function mountSingleReferencedProject(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $projectId,
        string $rootFileId = ''
    ): void {
        if ($rootFileId === '') {
            throw new RuntimeException('Missing referenced project root file id');
        }

        $result = $this->gateway->mountReferencedProject(
            $dataIsolation,
            $sandboxId,
            $projectId,
            $rootFileId
        );

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][Domain] Failed to mount referenced project', [
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
                'code' => $result->getCode(),
                'message' => $result->getMessage(),
            ]);
            throw new RuntimeException($result->getMessage());
        }

        $this->logger->info('[Sandbox][Domain] Referenced project mounted', [
            'sandbox_id' => $sandboxId,
            'project_id' => $projectId,
        ]);
    }
}
