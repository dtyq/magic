<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Service;

use App\Application\Design\Event\Message\DesignVideoPollMessage;
use App\Application\Design\Event\Publish\DesignVideoPollDelayPublisher;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Entity\ValueObject\DesignGenerationStatus;
use App\Domain\Design\Factory\DesignVideoInputPayloadPreparer;
use App\Domain\Design\Factory\PathFactory;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\Design\Service\DesignVideoSubmissionDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\VideoCatalog\Entity\ValueObject\VideoCatalogModelDefinition;
use App\Domain\VideoCatalog\Service\VideoCatalogQueryDomainService;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Design\DTO\VideoPointEstimateDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Amqp\Producer;
use Hyperf\Database\Exception\QueryException;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class DesignVideoAppService extends DesignAppService
{
    // 给 payload builder 的能力标记：支持图片 URL 时就不再转 base64。
    private const string REQUEST_KEY_SUPPORTS_IMAGE_INPUT_URL = 'supports_image_input_url';

    private const string SOURCE_ID_DESIGN_VIDEO_GENERATION = 'design_video_generation';

    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly VideoCatalogQueryDomainService $videoCatalogDomainService,
        private readonly DesignGenerationTaskDomainService $designGenerationTaskDomainService,
        private readonly DesignVideoSubmissionDomainService $submissionDomainService,
        private readonly Producer $producer,
    ) {
    }

    /**
     * 创建 Design 视频生成任务：校验项目与素材、保存本地任务、提交模型网关并投递首次轮询。
     */
    public function create(Authenticatable $authenticatable, DesignGenerationTaskEntity $entity): DesignGenerationTaskEntity
    {
        $designDataIsolation = $this->createDesignDataIsolation($authenticatable);
        $project = $this->assertProjectAccess($designDataIsolation, $entity->getProjectId(), MemberRole::EDITOR);
        $modelDefinition = $this->findModelOrFail($entity->getModelId());
        $outputDirectory = $this->assertWorkspacePathsExist(
            $designDataIsolation->getCurrentOrganizationCode(),
            $project->getId(),
            $entity
        );
        // 记录输出目录 ID，后续目录被改名或移动时仍可按 ID 找到真实目录。
        $entity->setOutputDirectoryFileId($outputDirectory->getFileId());

        $existingEntity = $this->designGenerationTaskDomainService->findVideoTask($designDataIsolation, $project->getId(), $entity->getGenerationId());
        if ($existingEntity !== null) {
            return $this->prepareResponseEntity($project, $existingEntity);
        }

        $requestPayload = $this->prepareGatewayPayloadWithBusinessParams(
            $designDataIsolation,
            $entity->getRequestPayload(),
            $entity->getProjectId(),
            $entity->getGenerationId()
        );
        // 先在请求体里写入能力开关，后续 builder 就能无状态地选择图片输入格式。
        $requestPayload[self::REQUEST_KEY_SUPPORTS_IMAGE_INPUT_URL] = $this->supportsImageInputUrl($modelDefinition);
        $entity->setOrganizationCode($designDataIsolation->getCurrentOrganizationCode());
        $entity->setUserId($designDataIsolation->getCurrentUserId());
        $entity->setRequestPayload($requestPayload);

        // 写入任务记录，幂等处理并发重复写入
        try {
            $this->designGenerationTaskDomainService->createTask($designDataIsolation, $entity);
        } catch (Throwable $throwable) {
            if ($this->isDuplicateGenerationTask($throwable)) {
                $duplicateEntity = $this->designGenerationTaskDomainService->findVideoTask($designDataIsolation, $project->getId(), $entity->getGenerationId());
                if ($duplicateEntity !== null) {
                    return $this->prepareResponseEntity($project, $duplicateEntity);
                }
            }
            throw $throwable;
        }

        // 调用外部网关提交任务，失败则删除任务记录
        try {
            $providerPayload = $this->submissionDomainService->submit($entity);
        } catch (Throwable $throwable) {
            $this->designGenerationTaskDomainService->deleteTask($designDataIsolation, $entity);
            throw $throwable;
        }

        $this->designGenerationTaskDomainService->markAsSubmitted($designDataIsolation, $entity, $providerPayload);

        // 投递首次 poll 消息，失败则记录重试信息，由 crontab 兜底恢复
        try {
            $this->producer->produce($this->buildInitialPollPublisher($entity));
            $this->designGenerationTaskDomainService->markFirstPollSent($designDataIsolation, $entity);
        } catch (Throwable $throwable) {
            $this->designGenerationTaskDomainService->markFirstPollDispatchFailed(
                $designDataIsolation,
                $entity,
                $throwable->getMessage(),
                $this->buildFirstPollNextRetryAt()
            );
            ExceptionBuilder::throw(DesignErrorCode::ThirdPartyServiceError, 'design.video_generation.first_poll_dispatch_failed');
        }

        return $this->prepareResponseEntity($project, $entity);
    }

    /**
     * 查询视频生成任务，并在完成态补齐归档文件的预览地址。
     */
    public function query(Authenticatable $authenticatable, int $projectId, string $videoId): DesignGenerationTaskEntity
    {
        $designDataIsolation = $this->createDesignDataIsolation($authenticatable);
        $project = $this->assertProjectAccess($designDataIsolation, $projectId, MemberRole::VIEWER);

        $entity = $this->designGenerationTaskDomainService->findVideoTask($designDataIsolation, $projectId, $videoId);
        if ($entity === null) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.not_found', ['label' => $videoId]);
        }

        if ($entity->getStatus() === DesignGenerationStatus::COMPLETED) {
            $this->hydrateCompletedTaskFiles($project, $entity);
        }

        return $entity;
    }

    /**
     * 预估视频生成需要消耗的积分，并在进入模型网关前完成项目权限和参考素材校验。
     */
    public function estimatePoints(Authenticatable $authenticatable, DesignVideoCreateDTO $dto): VideoPointEstimateDTO
    {
        $dto->validForEstimate();
        $designDataIsolation = $this->createDesignDataIsolation($authenticatable);
        $projectId = $dto->getProjectId();

        // 检查项目权限
        $this->assertProjectAccess($designDataIsolation, $projectId, MemberRole::EDITOR);

        $this->findModelOrFail($dto->getModelId());
        $payload = $dto->toModelGatewayPayload();
        $payload['inputs'] = $this->prepareEstimateInputs(
            $designDataIsolation->getCurrentOrganizationCode(),
            $projectId,
            $dto,
        );

        $payload = $this->prepareGatewayPayloadWithBusinessParams(
            $designDataIsolation,
            $payload,
            $projectId
        );
        $businessParams = $payload['business_params'];

        return VideoPointEstimateDTO::fromArray($this->submissionDomainService->estimate($payload, [
            'organization_code' => (string) $businessParams['organization_code'],
            'user_id' => (string) $businessParams['user_id'],
        ]));
    }

    /**
     * 将 Design 视频上下文写入模型网关 payload，并把 topic/task 迁移到计费业务参数。
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function prepareGatewayPayloadWithBusinessParams(
        DesignDataIsolation $dataIsolation,
        array $payload,
        int $projectId,
        ?string $videoId = null
    ): array {
        $businessParams = [
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'project_id' => $projectId,
            'source_id' => self::SOURCE_ID_DESIGN_VIDEO_GENERATION,
        ];

        if ($videoId !== null && $videoId !== '') {
            $businessParams['video_id'] = $videoId;
        }

        if (isset($payload['topic_id'])) {
            $businessParams['magic_topic_id'] = $payload['topic_id'];
            unset($payload['topic_id']);
        }

        if (isset($payload['task_id'])) {
            $businessParams['magic_task_id'] = $payload['task_id'];
            unset($payload['task_id']);
        }

        $payload['business_params'] = $businessParams;

        return $payload;
    }

    /**
     * 查询视频模型定义，找不到时统一抛 Design 参数错误。
     */
    private function findModelOrFail(string $modelId): VideoCatalogModelDefinition
    {
        $modelDefinition = $this->videoCatalogDomainService->findModel($modelId);
        if ($modelDefinition === null) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.not_found', ['label' => $modelId]);
        }

        return $modelDefinition;
    }

    /**
     * 判断当前 provider 是否支持直接传图片 URL，用于生成任务 payload 构建。
     */
    private function supportsImageInputUrl(VideoCatalogModelDefinition $modelDefinition): bool
    {
        return $modelDefinition->getProviderCode() === ProviderCode::VolcengineArk->value;
    }

    /**
     * 规范化并校验预估请求引用的工作区素材路径，返回可传给模型网关的 inputs。
     *
     * @return array<string, mixed>
     */
    private function prepareEstimateInputs(string $organizationCode, int $projectId, DesignVideoCreateDTO $dto): array
    {
        $workspacePrefix = PathFactory::getWorkspacePrefix($this->fileDomainService->getFullPrefix($organizationCode), $projectId);
        $inputs = DesignVideoInputPayloadPreparer::prepareInputs($dto);
        $this->assertWorkspaceInputPayloadFilesExist($workspacePrefix, $inputs);

        return $inputs;
    }

    /**
     * 校验输出目录和所有输入素材均在当前项目工作区内存在。
     */
    private function assertWorkspacePathsExist(string $organizationCode, int $projectId, DesignGenerationTaskEntity $entity): TaskFileEntity
    {
        $filePrefix = $this->fileDomainService->getFullPrefix($organizationCode);
        $workspacePrefix = PathFactory::getWorkspacePrefix($filePrefix, $projectId);
        $fullFileDir = PathFactory::buildFullDirPath($filePrefix, $projectId, $entity->getFileDir());

        $taskFileDir = $this->taskFileDomainService->getByFileKey($fullFileDir);
        if (! $taskFileDir || ! $taskFileDir->getIsDirectory()) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.video_generation.file_dir_not_exists', ['file_dir' => $entity->getFileDir()]);
        }

        $inputPayload = $entity->getInputPayload();
        $this->assertWorkspaceInputPayloadFilesExist($workspacePrefix, $inputPayload);
    }

    /**
     * 校验视频输入素材文件确实存在于当前项目工作区。
     *
     * @param array<string, mixed> $inputPayload
     */
    private function assertWorkspaceInputPayloadFilesExist(string $workspacePrefix, array $inputPayload): void
    {
        foreach ((array) ($inputPayload['reference_images'] ?? []) as $referenceImage) {
            $this->assertWorkspaceFileExists($workspacePrefix, (string) ($referenceImage['uri'] ?? ''));
        }

        foreach ((array) ($inputPayload['reference_videos'] ?? []) as $referenceVideo) {
            $this->assertWorkspaceFileExists($workspacePrefix, (string) ($referenceVideo['uri'] ?? ''));
        }

        foreach ((array) ($inputPayload['reference_audios'] ?? []) as $referenceAudio) {
            $this->assertWorkspaceFileExists($workspacePrefix, (string) ($referenceAudio['uri'] ?? ''));
        }

        $maskUri = (string) ($inputPayload['mask']['uri'] ?? '');
        if ($maskUri !== '') {
            $this->assertWorkspaceFileExists($workspacePrefix, $maskUri);
        }

        foreach ((array) ($inputPayload['frames'] ?? []) as $frame) {
            $this->assertWorkspaceFileExists($workspacePrefix, (string) ($frame['uri'] ?? ''));
        }

        return $taskFileDir;
    }

    /**
     * 校验单个工作区文件存在且不是目录，避免把无效素材提交给模型网关。
     */
    private function assertWorkspaceFileExists(string $workspacePrefix, string $relativePath): void
    {
        $taskFile = $this->taskFileDomainService->getByFileKey($workspacePrefix . $relativePath);
        if (! $taskFile || $taskFile->getIsDirectory()) {
            ExceptionBuilder::throw(
                DesignErrorCode::InvalidArgument,
                'design.video_generation.reference_file_not_exists',
                ['file_key' => $relativePath]
            );
        }
    }

    /**
     * 统一返回任务实体；完成态需要补齐文件 URL 后再返回给前端。
     */
    private function prepareResponseEntity(ProjectEntity $project, DesignGenerationTaskEntity $entity): DesignGenerationTaskEntity
    {
        if ($entity->getStatus() === DesignGenerationStatus::COMPLETED) {
            $this->hydrateCompletedTaskFiles($project, $entity);
        }

        return $entity;
    }

    /**
     * 根据归档路径回查文件 ID 和预览 URL；文件缺失时把任务标记为失败态返回。
     */
    private function hydrateCompletedTaskFiles(ProjectEntity $project, DesignGenerationTaskEntity $entity): void
    {
        $filePrefix = $this->fileDomainService->getFullPrefix($entity->getOrganizationCode());
        $relativeFilePath = (string) ($entity->getOutputPayload()['relative_file_path'] ?? '');
        if ($relativeFilePath !== '') {
            $taskFile = $this->taskFileDomainService->getByFileKey(PathFactory::getWorkspacePrefix($filePrefix, $entity->getProjectId()) . $relativeFilePath);
            if ($taskFile) {
                $entity->setFileId($taskFile->getFileId());
                $entity->setFileUrl(
                    $this->taskFileDomainService->getFileUrls(
                        projectOrganizationCode: $project->getUserOrganizationCode(),
                        projectId: $project->getId(),
                        fileIds: [$taskFile->getFileId()],
                        downloadMode: 'preview'
                    )[0]['url'] ?? null
                );
            } else {
                $entity->setStatus(DesignGenerationStatus::FAILED);
                $entity->setErrorMessage('Generated video file not found');
            }
        }

        $relativePosterPath = (string) ($entity->getOutputPayload()['relative_poster_path'] ?? '');
        if ($relativePosterPath !== '') {
            $posterTaskFile = $this->taskFileDomainService->getByFileKey(PathFactory::getWorkspacePrefix($filePrefix, $entity->getProjectId()) . $relativePosterPath);
            if ($posterTaskFile) {
                $entity->setPosterFileId($posterTaskFile->getFileId());
                $entity->setPosterUrl(
                    $this->taskFileDomainService->getFileUrls(
                        projectOrganizationCode: $project->getUserOrganizationCode(),
                        projectId: $project->getId(),
                        fileIds: [$posterTaskFile->getFileId()],
                        downloadMode: 'preview'
                    )[0]['url'] ?? null
                );
            }
        }
    }

    /**
     * 构造首次轮询延迟消息，提交成功后立刻开始跟踪 provider 任务状态。
     */
    private function buildInitialPollPublisher(DesignGenerationTaskEntity $entity): DesignVideoPollDelayPublisher
    {
        return new DesignVideoPollDelayPublisher(new DesignVideoPollMessage(
            $entity->getOrganizationCode(),
            $entity->getProjectId(),
            $entity->getGenerationId(),
        ));
    }

    /**
     * 首次轮询投递失败时，记录下一次兜底重试时间。
     */
    private function buildFirstPollNextRetryAt(): string
    {
        return date(DATE_ATOM, time() + 60);
    }

    /**
     * 识别同一个 video_id 并发创建导致的唯一键冲突，用于返回已存在任务。
     */
    private function isDuplicateGenerationTask(Throwable $throwable): bool
    {
        return $throwable instanceof QueryException
            && $throwable->getCode() === '23000'
            && str_contains($throwable->getMessage(), 'Duplicate entry');
    }
}
