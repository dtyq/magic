<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Service;

use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\Design\Entity\ValueObject\ImageGenerationStatus;
use App\Domain\Design\Entity\ValueObject\ImageGenerationType;
use App\Domain\Design\Factory\PathFactory;
use App\Domain\Design\Service\ImageGenerationDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * 图片生成应用服务
 */
class ImageGenerationAppService extends DesignAppService
{
    public function __construct(
        private readonly ImageGenerationDomainService $domainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly AiAbilityDomainService $aiAbilityDomainService,
    ) {
    }

    /**
     * 生成图片（创建任务）.
     */
    public function generateImage(Authenticatable $authenticatable, ImageGenerationEntity $entity): ImageGenerationEntity
    {
        $dataIsolation = $this->createDesignDataIsolation($authenticatable);

        // 检查 project_id 是否存在
        $project = $this->projectDomainService->getProjectNotUserId($entity->getProjectId());

        // 判断是否具有该项目的权限
        $this->validateRoleHigherOrEqual($dataIsolation, $project, MemberRole::EDITOR);

        $filePrefix = $this->fileDomainService->getFullPrefix($dataIsolation->getCurrentOrganizationCode());
        $workspacePrefix = PathFactory::getWorkspacePrefix($filePrefix, $project->getId());

        // 兼容传入完整路径的场景：若已包含工作区前缀，剥离后转为相对路径
        $fileDir = $entity->getFileDir();
        if (str_starts_with($fileDir, $workspacePrefix)) {
            $fileDir = substr($fileDir, strlen($workspacePrefix));
            $entity->setFileDir($fileDir);
        }

        $relativeFileDir = $entity->getFileDir();
        $fullFileDir = $entity->getFullFileDir($filePrefix);

        // 检查当前目录是否存在
        $taskFileDir = $this->taskFileDomainService->getByFileKey($fullFileDir);
        if (! $taskFileDir || ! $taskFileDir->getIsDirectory()) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_generation.file_dir_not_exists', ['file_dir' => $relativeFileDir]);
        }
        $entity->setFileDirId($taskFileDir->getFileId());

        // 检查引用图片是否存在，同样兼容完整路径
        $referenceImages = $entity->getReferenceImages() ?? [];
        $normalizedReferenceImages = [];
        foreach ($referenceImages as $referenceImage) {
            // 若已包含工作区前缀，剥离后转为相对路径
            if (str_starts_with($referenceImage, $workspacePrefix)) {
                $referenceImage = substr($referenceImage, strlen($workspacePrefix));
            }
            $normalizedReferenceImages[] = $referenceImage;

            // design-mark 临时文件不在工作区内，跳过 DB 校验
            if (str_contains($referenceImage, 'design-mark/')) {
                continue;
            }

            $fullReferenceImage = $workspacePrefix . $referenceImage;

            $taskFile = $this->taskFileDomainService->getByFileKey($fullReferenceImage);
            if (! $taskFile || $taskFile->getIsDirectory()) {
                ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_generation.reference_image_not_exists', ['file_key' => $referenceImage]);
            }
        }
        // 将归一化后的相对路径写回实体，保证后续 subscriber 正确拼接
        if (! empty($normalizedReferenceImages)) {
            $entity->setReferenceImages($normalizedReferenceImages);
        }

        $this->domainService->createTask($dataIsolation, $entity);

        return $entity;
    }

    public function generateHighImage(Authenticatable $authenticatable, ImageGenerationEntity $entity): ImageGenerationEntity
    {
        $entity->setType(ImageGenerationType::UPSCALE);
        $entity->setPrompt('');
        // 先临时使用一个 model_id，在任务执行完成后，会修改这个值
        $entity->setModelId('design_image_high');

        // 复用生图逻辑，使用同一个表来完成
        return $this->generateImage($authenticatable, $entity);
    }

    /**
     * 橡皮擦（原图 + 标记图，擦除标记区域）.
     */
    public function generateEraser(Authenticatable $authenticatable, ImageGenerationEntity $entity): ImageGenerationEntity
    {
        $entity->setType(ImageGenerationType::ERASER);

        [$modelId, $prompt] = $this->resolveAbilityModelAndPrompt(AiAbilityCode::ImageEraser);
        $entity->setModelId($modelId);
        $entity->setPrompt($prompt);

        return $this->generateImage($authenticatable, $entity);
    }

    /**
     * 扩图（扩展画布图 + mask 图，由模型填充扩展区域）.
     */
    public function generateExpandImage(Authenticatable $authenticatable, ImageGenerationEntity $entity): ImageGenerationEntity
    {
        $entity->setType(ImageGenerationType::EXPAND);

        [$modelId, $prompt] = $this->resolveAbilityModelAndPrompt(AiAbilityCode::ImageExpand);
        $entity->setModelId($modelId);
        $entity->setPrompt($prompt);

        return $this->generateImage($authenticatable, $entity);
    }

    /**
     * 去背景.
     */
    public function generateRemoveBackground(Authenticatable $authenticatable, ImageGenerationEntity $entity): ImageGenerationEntity
    {
        $entity->setType(ImageGenerationType::REMOVE_BACKGROUND);
        $this->assertRemoveBackgroundAbilityAvailable();

        $entity->setPrompt('');
        // 任务完成后由专用链路产出结果，此处仅占位
        $entity->setModelId('design_image_remove_background');

        return $this->generateImage($authenticatable, $entity);
    }

    /**
     * 查询图片生成结果.
     */
    public function queryImageGeneration(Authenticatable $authenticatable, int $projectId, string $imageId): ImageGenerationEntity
    {
        $dataIsolation = $this->createDesignDataIsolation($authenticatable);

        // 检查 project_id 是否存在
        $project = $this->projectDomainService->getProjectNotUserId($projectId);

        // 判断是否具有该项目的权限
        $this->validateRoleHigherOrEqual($dataIsolation, $project, MemberRole::VIEWER);

        $entity = $this->domainService->queryByProjectAndImageId($dataIsolation, $projectId, $imageId);
        if (! $entity) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.not_found', ['label' => $imageId]);
        }

        $fileUrl = null;
        if ($entity->getStatus() === ImageGenerationStatus::COMPLETED) {
            // 设置 url，需要使用完整路径
            $filePrefix = $this->fileDomainService->getFullPrefix($entity->getOrganizationCode());
            $fullFilePath = $entity->getFullFilePath($filePrefix);

            $taskFile = $this->taskFileDomainService->getByFileKey($fullFilePath);
            if (! $taskFile) {
                $entity->setStatus(ImageGenerationStatus::FAILED);
                $entity->setErrorMessage('Generated file not found');
                return $entity;
            }

            $fileUrl = $this->taskFileDomainService->getFileUrls(
                projectOrganizationCode: $project->getUserOrganizationCode(),
                projectId: $project->getId(),
                fileIds: [$taskFile->getFileId()],
                downloadMode: 'preview'
            )[0]['url'] ?? '';
        }
        $entity->setFileUrl($fileUrl);

        return $entity;
    }

    /**
     * 从 AI 能力配置中解析 model_id 和 prompt（仅配置值，trim 后可能为空，由 Handler 决定是否使用内置默认提示词）.
     *
     * @return array{0: string, 1: string} [modelId, prompt]
     */
    private function resolveAbilityModelAndPrompt(AiAbilityCode $code): array
    {
        $entity = $this->aiAbilityDomainService->getByCode(ProviderDataIsolation::create('')->disabled(), $code);

        if ($entity === null || ! $entity->isEnabled()) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_generation.feature_unavailable');
        }

        $config = $entity->getConfig();
        $modelId = $config['model_id'] ?? null;

        if (empty($modelId)) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_generation.feature_unavailable');
        }

        $prompt = trim((string) ($config['prompt'] ?? ''));

        return [$modelId, $prompt];
    }

    /**
     * 校验去背景能力已启用且存在至少一个启用的 provider（与专用网关 /images/remove-background 一致）.
     */
    private function assertRemoveBackgroundAbilityAvailable(): void
    {
        $entity = $this->aiAbilityDomainService->getByCode(ProviderDataIsolation::create('')->disabled(), AiAbilityCode::ImageRemoveBackground);

        if ($entity === null || ! $entity->isEnabled()) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_generation.feature_unavailable');
        }

        $providers = $entity->getConfig()['providers'] ?? [];
        if (! is_array($providers)) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_generation.feature_unavailable');
        }

        foreach ($providers as $provider) {
            if (is_array($provider) && ($provider['enable'] ?? false) === true) {
                return;
            }
        }

        ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_generation.feature_unavailable');
    }
}
