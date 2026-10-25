<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Service;

use App\Application\Design\Event\Message\DesignVideoPollMessage;
use App\Application\Design\Event\Message\DesignVideoSubmitMessage;
use App\Application\Design\Event\Publish\DesignVideoPollDelayPublisher;
use App\Application\Design\Event\Publish\DesignVideoSubmitPublisher;
use App\Application\Design\Support\DesignDraftTaskResolver;
use App\Application\Design\Support\DesignVideoReferenceAssetResolver;
use App\Application\ModelGateway\Mapper\ModelEntry;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Entity\ValueObject\DesignGenerationStatus;
use App\Domain\Design\Factory\DesignVideoInputPayloadPreparer;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\Design\Service\DesignVideoSubmissionDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\File\ImageBase64DataUriParser;
use App\Infrastructure\Util\File\ProviderAssetUri;
use App\Interfaces\Design\DTO\VideoPointEstimateDTO;
use Hyperf\Amqp\Producer;
use Hyperf\Database\Exception\QueryException;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class DesignVideoAppService extends DesignAppService
{
    // 给 payload builder 的能力标记：支持图片 URL 时就不再转 base64。
    private const string REQUEST_KEY_SUPPORTS_IMAGE_INPUT_URL = 'supports_image_input_url';

    // 给 payload builder 的能力标记：允许透传 provider 专用 asset URI。
    private const string REQUEST_KEY_SUPPORTS_PROVIDER_ASSET_URI = 'supports_provider_asset_uri';

    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly ModelGatewayMapper $modelGatewayMapper,
        private readonly DesignGenerationTaskDomainService $designGenerationTaskDomainService,
        private readonly DesignVideoSubmissionDomainService $submissionDomainService,
        private readonly DesignDraftTaskResolver $draftTaskResolver,
        private readonly DesignVideoReferenceAssetResolver $referenceAssetResolver,
        private readonly Producer $producer,
    ) {
    }

    /**
     * 创建 Design 视频生成任务：校验项目与素材、保存本地任务并投递异步执行消息。
     */
    public function create(Authenticatable $authenticatable, DesignGenerationTaskEntity $entity): DesignGenerationTaskEntity
    {
        $designDataIsolation = $this->createDesignDataIsolation($authenticatable);
        $project = $this->assertProjectAccess($designDataIsolation, $entity->getProjectId(), MemberRole::EDITOR);
        $modelEntry = null;
        $supportsProviderAssetUri = false;
        if ($entity->isCanvasComposition()) {
            $outputDirectory = $this->assertCanvasCompositionPathsExist($project->getId(), $entity);
            $entity->setOutputDirectoryFileId($outputDirectory->getFileId());
        } else {
            $modelEntry = $this->findModelOrFail($designDataIsolation, $entity->getModelId());
            $supportsProviderAssetUri = $this->supportsProviderAssetUri($modelEntry);
            $outputDirectory = $this->assertWorkspacePathsExist(
                $project->getId(),
                $entity,
                $supportsProviderAssetUri,
            );
            // 记录输出目录 ID，后续目录被改名或移动时仍可按 ID 找到真实目录。
            $entity->setOutputDirectoryFileId($outputDirectory->getFileId());
            // 火山方舟：先校验原始工作区路径，再把引用素材材质化为本人个人资产，
            // 改写后的 asset:// uri 会随 inputPayload/requestPayload 一起进入后续提交链路。
            if ($supportsProviderAssetUri) {
                $this->referenceAssetResolver->resolve($designDataIsolation, $entity);
            }
            // 样片成片：把样片引用解析成下游样片任务 ID，并继承样片时长与成片分辨率。
            $this->draftTaskResolver->resolve($designDataIsolation, $entity);
        }

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
        if ($modelEntry !== null) {
            $requestPayload[self::REQUEST_KEY_SUPPORTS_IMAGE_INPUT_URL] = $this->supportsImageInputUrl($modelEntry);
            $requestPayload[self::REQUEST_KEY_SUPPORTS_PROVIDER_ASSET_URI] = $supportsProviderAssetUri;
        }
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

        // 普通生视频沿用同步提交；画布合成需要初始化沙箱，交给独立消费者异步提交。
        if (! $entity->isCanvasComposition()) {
            try {
                $providerPayload = $this->submissionDomainService->submit($entity);
            } catch (Throwable $throwable) {
                $this->designGenerationTaskDomainService->deleteTask($designDataIsolation, $entity);
                throw $throwable;
            }

            $this->designGenerationTaskDomainService->markAsSubmitted($designDataIsolation, $entity, $providerPayload);
        }

        // 投递首次执行消息，失败则记录重试信息，由 crontab 兜底恢复。
        try {
            $this->producer->produce($this->buildInitialPublisher($entity));
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

    public function estimatePoints(Authenticatable $authenticatable, DesignVideoCreateDTO $dto): VideoPointEstimateDTO
    {
        $dto->validForEstimate();
        $designDataIsolation = $this->createDesignDataIsolation($authenticatable);
        $projectId = $dto->getProjectId();

        // 检查项目权限
        $this->assertProjectAccess($designDataIsolation, $projectId, MemberRole::EDITOR);

        $this->findModelOrFail($designDataIsolation, $dto->getModelId());
        $payload = $dto->toModelGatewayPayload();
        $payload['inputs'] = DesignVideoInputPayloadPreparer::prepareInputs($dto);

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
            'source_id' => SourceId::DESIGN_VIDEO_GENERATION,
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
    private function findModelOrFail(DesignDataIsolation $dataIsolation, string $modelId): ModelEntry
    {
        $modelEntry = $this->modelGatewayMapper->getOrganizationVideoModel($dataIsolation, $modelId);
        if (! $modelEntry instanceof ModelEntry || ! $modelEntry->isVideoModel()) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.not_found', ['label' => $modelId]);
        }

        return $modelEntry;
    }

    /**
     * 判断当前 provider 是否支持直接传图片 URL，用于生成任务 payload 构建。
     */
    private function supportsImageInputUrl(ModelEntry $modelEntry): bool
    {
        $providerCode = $modelEntry->getVideoModel()?->getProviderCode();

        return in_array(
            $providerCode?->value,
            [
                ProviderCode::VolcengineArk->value,
                ProviderCode::Keling->value,
                ProviderCode::DashScope->value,
            ]
        );
    }

    /**
     * 校验输出目录和所有输入素材均在当前项目工作区内存在。
     */
    private function assertWorkspacePathsExist(
        int $projectId,
        DesignGenerationTaskEntity $entity,
        bool $supportsProviderAssetUri,
    ): TaskFileEntity {
        // Verify target directory exists via tree navigation
        $taskFileDir = $this->taskFileDomainService->findEntityByRelativePath($projectId, $entity->getFileDir());
        if (! $taskFileDir || ! $taskFileDir->getIsDirectory()) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.video_generation.file_dir_not_exists', ['file_dir' => $entity->getFileDir()]);
        }

        $inputPayload = $entity->getInputPayload();
        $this->assertWorkspaceInputPayloadFilesExist($projectId, $inputPayload, $supportsProviderAssetUri);

        return $taskFileDir;
    }

    /** 校验文件列表合成的输出目录和所有输入媒体。 */
    private function assertCanvasCompositionPathsExist(
        int $projectId,
        DesignGenerationTaskEntity $entity,
    ): TaskFileEntity {
        $taskFileDir = $this->taskFileDomainService->findEntityByRelativePath($projectId, $entity->getFileDir());
        if (! $taskFileDir || ! $taskFileDir->getIsDirectory()) {
            ExceptionBuilder::throw(
                DesignErrorCode::InvalidArgument,
                'design.video_generation.file_dir_not_exists',
                ['file_dir' => $entity->getFileDir()]
            );
        }

        $requestPayload = $entity->getRequestPayload();
        $composition = is_array($requestPayload['composition'] ?? null) ? $requestPayload['composition'] : [];
        /** @var array<string, array{names: array<string, bool>, paths: array<string, string>}> $filesByParentPath */
        $filesByParentPath = [];
        foreach (['videos', 'audios'] as $mediaType) {
            foreach ((array) ($composition[$mediaType] ?? []) as $media) {
                $path = trim((string) ($media['path'] ?? ''));
                [$parentPath, $fileName] = $this->splitWorkspacePath($path);
                $filesByParentPath[$parentPath]['names'][$fileName] = true;
                $filesByParentPath[$parentPath]['paths'][$fileName] = $path;
            }
        }

        foreach ($filesByParentPath as $parentPath => $fileData) {
            $parentDirectory = $this->normalizeWorkspacePath($entity->getFileDir()) === $parentPath
                ? $taskFileDir
                : $this->taskFileDomainService->findEntityByRelativePath($projectId, $parentPath);
            if (! $parentDirectory || ! $parentDirectory->getIsDirectory()) {
                $missingPath = array_values($fileData['paths'])[0] ?? $parentPath;
                ExceptionBuilder::throw(
                    DesignErrorCode::InvalidArgument,
                    'design.video_generation.reference_file_not_exists',
                    ['file_key' => $missingPath]
                );
            }

            $fileNames = array_keys($fileData['names']);
            $files = $this->taskFileDomainService->getByProjectParentAndNames(
                $projectId,
                $parentDirectory->getFileId(),
                $fileNames,
            );
            foreach ($fileData['paths'] as $fileName => $path) {
                $taskFile = $files[$fileName] ?? null;
                if (! $taskFile || $taskFile->getIsDirectory()) {
                    ExceptionBuilder::throw(
                        DesignErrorCode::InvalidArgument,
                        'design.video_generation.reference_file_not_exists',
                        ['file_key' => $path]
                    );
                }
            }
        }

        return $taskFileDir;
    }

    /**
     * 拆分工作区相对路径，返回父目录路径和文件名。
     *
     * @return array{string, string}
     */
    private function splitWorkspacePath(string $path): array
    {
        $segments = array_values(array_filter(
            explode('/', trim($path, '/')),
            static fn (string $segment): bool => $segment !== ''
        ));
        $fileName = (string) array_pop($segments);
        $parentPath = $segments === [] ? '/' : '/' . implode('/', $segments);

        return [$parentPath, $fileName];
    }

    /** 统一工作区路径格式，用于判断是否可以复用已解析的输出目录。 */
    private function normalizeWorkspacePath(string $path): string
    {
        $path = '/' . trim($path, '/');
        return $path === '/' ? $path : rtrim($path, '/');
    }

    /**
     * 校验视频输入素材文件确实存在于当前项目工作区。
     *
     * @param array<string, mixed> $inputPayload
     */
    private function assertWorkspaceInputPayloadFilesExist(
        int $projectId,
        array $inputPayload,
        bool $supportsProviderAssetUri = false,
    ): void {
        foreach ((array) ($inputPayload['reference_images'] ?? []) as $referenceImage) {
            $this->assertWorkspaceInputUri($projectId, (string) ($referenceImage['uri'] ?? ''), $supportsProviderAssetUri);
        }

        foreach ((array) ($inputPayload['reference_videos'] ?? []) as $referenceVideo) {
            $this->assertWorkspaceInputUri($projectId, (string) ($referenceVideo['uri'] ?? ''), $supportsProviderAssetUri);
        }

        foreach ((array) ($inputPayload['reference_audios'] ?? []) as $referenceAudio) {
            $this->assertWorkspaceInputUri($projectId, (string) ($referenceAudio['uri'] ?? ''), $supportsProviderAssetUri);
        }

        $maskUri = (string) ($inputPayload['mask']['uri'] ?? '');
        if ($maskUri !== '') {
            $this->assertWorkspaceFileExists($projectId, $maskUri);
        }

        foreach ((array) ($inputPayload['frames'] ?? []) as $frame) {
            $this->assertWorkspaceInputUri($projectId, (string) ($frame['uri'] ?? ''), $supportsProviderAssetUri);
        }
    }

    /**
     * 仅对工作区路径执行文件存在校验，内联 Base64 图片由入口完成校验。
     */
    private function assertWorkspaceInputUri(int $projectId, string $uri, bool $supportsProviderAssetUri = false): void
    {
        if (ImageBase64DataUriParser::isValid($uri) || ($supportsProviderAssetUri && ProviderAssetUri::isValid($uri))) {
            return;
        }

        $this->assertWorkspaceFileExists($projectId, $uri);
    }

    /**
     * 校验单个工作区文件存在且不是目录，避免把无效素材提交给模型网关。
     */
    private function assertWorkspaceFileExists(int $projectId, string $relativePath): void
    {
        $taskFile = $this->taskFileDomainService->findEntityByRelativePath($projectId, $relativePath);
        if (! $taskFile || $taskFile->getIsDirectory()) {
            ExceptionBuilder::throw(
                DesignErrorCode::InvalidArgument,
                'design.video_generation.reference_file_not_exists',
                ['file_key' => $relativePath]
            );
        }
    }

    /**
     * 判断当前 provider 是否支持将 asset URI 原样传给模型接口。
     */
    private function supportsProviderAssetUri(ModelEntry $modelEntry): bool
    {
        return $modelEntry->getVideoModel()?->getProviderCode() === ProviderCode::VolcengineArk;
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
        $relativeFilePath = (string) ($entity->getOutputPayload()['relative_file_path'] ?? '');
        if ($relativeFilePath !== '') {
            $taskFile = $this->taskFileDomainService->findEntityByRelativePath($entity->getProjectId(), $relativeFilePath);
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
                if ($entity->isCanvasComposition()) {
                    // 合成文件已由共享沙箱写入，MagicFS 文件索引可能稍后才可见；不要把暂时未索引误判为失败。
                    $providerUrl = trim((string) ($entity->getOutputPayload()['provider_video_url'] ?? ''));
                    if ($providerUrl !== '') {
                        $entity->setFileUrl($providerUrl);
                    }
                    return;
                }
                $entity->setStatus(DesignGenerationStatus::FAILED);
                $entity->setErrorMessage('Generated video file not found');
            }
        }

        $relativePosterPath = (string) ($entity->getOutputPayload()['relative_poster_path'] ?? '');
        if ($relativePosterPath !== '') {
            $posterTaskFile = $this->taskFileDomainService->findEntityByRelativePath($entity->getProjectId(), $relativePosterPath);
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
     * 构造首次异步消息；画布合成先进入提交队列，其他视频任务直接进入轮询队列。
     */
    private function buildInitialPublisher(DesignGenerationTaskEntity $entity): DesignVideoPollDelayPublisher|DesignVideoSubmitPublisher
    {
        if ($entity->isCanvasComposition()) {
            return new DesignVideoSubmitPublisher(new DesignVideoSubmitMessage(
                $entity->getOrganizationCode(),
                $entity->getProjectId(),
                $entity->getGenerationId(),
            ));
        }

        return $this->buildInitialPollPublisher($entity);
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
