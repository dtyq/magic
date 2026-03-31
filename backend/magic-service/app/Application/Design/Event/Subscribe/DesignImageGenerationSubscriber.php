<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Event\Subscribe;

use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Application\ModelGateway\Service\ImageLLMAppService;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\Design\Entity\ValueObject\ImageGenerationType;
use App\Domain\Design\Event\ImageGenerationTaskCreatedEvent;
use App\Domain\Design\Factory\PathFactory;
use App\Domain\Design\Service\ImageGenerationDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\ImageConvertHighDTO;
use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\CloudFile\Kernel\Struct\ImageProcessOptions;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\DbConnection\Db;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Support\retry;

#[AsyncListener]
#[Listener]
class DesignImageGenerationSubscriber implements ListenerInterface
{
    private ImageGenerationDomainService $imageGenerationDomainService;

    private TaskFileDomainService $taskFileDomainService;

    private FileDomainService $fileDomainService;

    private ProjectDomainService $projectDomainService;

    private MicroAgentFactory $microAgentFactory;

    private LoggerInterface $logger;

    public function __construct(ContainerInterface $container)
    {
        $this->imageGenerationDomainService = $container->get(ImageGenerationDomainService::class);
        $this->taskFileDomainService = $container->get(TaskFileDomainService::class);
        $this->fileDomainService = $container->get(FileDomainService::class);
        $this->projectDomainService = $container->get(ProjectDomainService::class);
        $this->microAgentFactory = $container->get(MicroAgentFactory::class);
        $this->logger = $container->get(LoggerFactory::class)->get(get_class($this));
    }

    public function listen(): array
    {
        return [
            ImageGenerationTaskCreatedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof ImageGenerationTaskCreatedEvent) {
            return;
        }
        $imageGenerationEntity = $event->imageGenerationEntity;

        $dataIsolation = DesignDataIsolation::create($imageGenerationEntity->getOrganizationCode(), $imageGenerationEntity->getUserId());

        $this->imageGenerationDomainService->markAsProcessing($dataIsolation, $imageGenerationEntity->getId());

        Db::beginTransaction();
        try {
            // 调用生图逻辑，文生图 or 图生图
            $response = $this->generateImage($dataIsolation, $imageGenerationEntity);
            if (! $response) {
                ExceptionBuilder::throw(DesignErrorCode::ThirdPartyServiceError, 'design.image_generation.generate_image_failed');
            }
            if (! empty($response->getProviderErrorMessage())) {
                $errorMessage = $response->getProviderErrorMessage();
                if (str_contains($errorMessage, '缺少图像数据')) {
                    // 根据是否有参考图选择不同的错误提示
                    $hasReferenceImages = ! empty($imageGenerationEntity->getReferenceImages());
                    $translationKey = $hasReferenceImages
                        ? 'design.image_generation.missing_image_data_error_with_reference'
                        : 'design.image_generation.missing_image_data_error_prompt_only';
                    ExceptionBuilder::throw(DesignErrorCode::ThirdPartyServiceError, $translationKey);
                }
                ExceptionBuilder::throw(DesignErrorCode::ThirdPartyServiceError, 'design.image_generation.generate_image_failed_with_message', ['message' => $errorMessage]);
            }
            $imageUrl = $this->parseResponseUrl($response);
            if (empty($imageUrl)) {
                ExceptionBuilder::throw(DesignErrorCode::ThirdPartyServiceError, 'design.image_generation.generate_image_failed');
            }

            // 获取图片后缀
            $extension = pathinfo(parse_url($imageUrl, PHP_URL_PATH), PATHINFO_EXTENSION);

            // 调用 MicroAgent 生成智能文件名（包含时间戳）
            $fileNameWithoutExtension = $this->generateIntelligentFileName($dataIsolation, $imageGenerationEntity, $imageGenerationEntity->getPrompt());

            // 组装最终文件名
            $fileName = $fileNameWithoutExtension . '.' . $extension;
            $imageGenerationEntity->setFileName($fileName);

            // 生图成功，回写数据库状态
            $this->imageGenerationDomainService->markAsCompleted($dataIsolation, $imageGenerationEntity->getId(), $fileName);

            // 准备文件
            $fullPrefix = $this->fileDomainService->getFullPrefix($dataIsolation->getCurrentOrganizationCode());
            $fullFileDir = $imageGenerationEntity->getFullFileDir($fullPrefix);

            $uploadPath = substr($fullFileDir, strlen($fullPrefix));
            $uploadFile = new UploadFile($imageUrl, $uploadPath, $fileName, false);

            // 写入 taskFile 表
            $this->createProjectFile($dataIsolation, $imageGenerationEntity, $uploadFile);

            // 上传到指定地方
            $this->fileDomainService->uploadByCredential($dataIsolation->getCurrentOrganizationCode(), $uploadFile, StorageBucketType::SandBox, false);
            Db::commit();
        } catch (Throwable $throwable) {
            // 回滚已经落库的数据
            Db::rollBack();
            // 记录为失败
            $this->imageGenerationDomainService->markAsFailed($dataIsolation, $imageGenerationEntity->getId(), $throwable->getMessage());
            return;
        }
    }

    protected function generateImage(DesignDataIsolation $dataIsolation, ImageGenerationEntity $imageGenerationEntity): ?OpenAIFormatResponse
    {
        $filePrefix = $this->fileDomainService->getFullPrefix($dataIsolation->getCurrentOrganizationCode());
        $workspacePrefix = PathFactory::getWorkspacePrefix($filePrefix, $imageGenerationEntity->getProjectId());

        $response = null;
        retry(1, function () use (&$response, $dataIsolation, $imageGenerationEntity, $workspacePrefix) {
            switch ($imageGenerationEntity->getType()) {
                case ImageGenerationType::UPSCALE:
                    // 转高清场景
                    $referenceImage = $imageGenerationEntity->getReferenceImages()[0] ?? null;
                    if (! $referenceImage) {
                        return null;
                    }
                    $fullReferenceImage = $workspacePrefix . $referenceImage;
                    $imageUrl = $this->fileDomainService->getLink($dataIsolation->getCurrentOrganizationCode(), $fullReferenceImage, StorageBucketType::SandBox)?->getUrl();

                    $userAuthorization = new MagicUserAuthorization();
                    $userAuthorization->setId($dataIsolation->getCurrentUserId());
                    $userAuthorization->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

                    $imageConvertHighReq = new ImageConvertHighDTO();
                    /* @phpstan-ignore-next-line constant is defined at runtime */
                    $imageConvertHighReq->setAccessToken(MAGIC_ACCESS_TOKEN);
                    $imageConvertHighReq->setBusinessParams([
                        'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                        'user_id' => $dataIsolation->getCurrentUserId(),
                        'source_id' => 'design_image_generation',
                    ]);
                    $imageConvertHighReq->setImages([$imageUrl]);

                    $response = di(ImageLLMAppService::class)->imageConvertHighV2($imageConvertHighReq);
                    return;
                case ImageGenerationType::EXPAND:
                case ImageGenerationType::ERASER:
                    // 橡皮擦场景：reference_images[0] 为原图（SandBox），reference_images[1] 为标记图（design-mark 走 Private）
                    $eraserDTO = new TextGenerateImageDTO();
                    /* @phpstan-ignore-next-line constant is defined at runtime */
                    $eraserDTO->setAccessToken(MAGIC_ACCESS_TOKEN);
                    $eraserDTO->setModel($imageGenerationEntity->getModelId());
                    $eraserDTO->setBusinessParams([
                        'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                        'user_id' => $dataIsolation->getCurrentUserId(),
                        'source_id' => 'design_image_generation',
                    ]);
                    $eraserDTO->setPrompt($imageGenerationEntity->getPrompt());
                    $eraserDTO->setN(1);

                    $imageUrls = [];
                    $eraserReferenceImageOptions = $imageGenerationEntity->getReferenceImageOptions() ?? [];

                    foreach ($imageGenerationEntity->getReferenceImages() ?? [] as $idx => $referenceImage) {
                        if (str_contains($referenceImage, 'design-mark/')) {
                            // 临时标记图，使用绝对路径直接从 Private bucket 获取链接
                            $imageUrl = $this->fileDomainService->getLink(
                                $dataIsolation->getCurrentOrganizationCode(),
                                $referenceImage,
                                StorageBucketType::Private
                            )?->getUrl();
                        } else {
                            // 普通工作区图片，拼接完整路径从 SandBox 获取链接，原图支持附带 crop 处理参数
                            $fullReferenceImage = $workspacePrefix . $referenceImage;
                            $linkOptions = [];
                            if (! empty($eraserReferenceImageOptions[$idx]['crop'])) {
                                $cropData = $eraserReferenceImageOptions[$idx]['crop'];
                                $imageProcessOptions = new ImageProcessOptions();
                                $imageProcessOptions->crop([
                                    'width' => (int) round((float) ($cropData['width'] ?? 0)),
                                    'height' => (int) round((float) ($cropData['height'] ?? 0)),
                                    'x' => (int) round((float) ($cropData['x'] ?? 0)),
                                    'y' => (int) round((float) ($cropData['y'] ?? 0)),
                                ]);
                                $linkOptions['image'] = $imageProcessOptions;
                            }
                            $imageUrl = $this->fileDomainService->getLink(
                                $dataIsolation->getCurrentOrganizationCode(),
                                $fullReferenceImage,
                                StorageBucketType::SandBox,
                                [],
                                $linkOptions
                            )?->getUrl();
                        }
                        if ($imageUrl) {
                            $imageUrls[] = $imageUrl;
                        }
                    }
                    if (! empty($imageUrls)) {
                        $eraserDTO->setImages($imageUrls);
                    }
                    if ($imageGenerationEntity->getSize()) {
                        $eraserDTO->setSize($imageGenerationEntity->getSize());
                    }
                    $response = di(LLMAppService::class)->textGenerateImageV2($eraserDTO);
                    break;
                case ImageGenerationType::REMOVE_BACKGROUND:
                case ImageGenerationType::IMAGE_TO_IMAGE:
                case ImageGenerationType::TEXT_TO_IMAGE:
                    // 调用第三方接口生成图片
                    $textGenerateImageDTO = new TextGenerateImageDTO();
                    /* @phpstan-ignore-next-line constant is defined at runtime */
                    $textGenerateImageDTO->setAccessToken(MAGIC_ACCESS_TOKEN);
                    $textGenerateImageDTO->setModel($imageGenerationEntity->getModelId());
                    $textGenerateImageDTO->setBusinessParams([
                        'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                        'user_id' => $dataIsolation->getCurrentUserId(),
                        'source_id' => 'design_image_generation',
                    ]);
                    $textGenerateImageDTO->setPrompt($imageGenerationEntity->getPrompt());
                    // 目前仅只生成 1 张
                    $textGenerateImageDTO->setN(1);

                    // 参考图（存储的是相对路径，需要拼接成完整路径）
                    $imageUrls = [];
                    $referenceImageOptions = $imageGenerationEntity->getReferenceImageOptions() ?? [];

                    foreach ($imageGenerationEntity->getReferenceImages() ?? [] as $idx => $referenceImage) {
                        $fullReferenceImage = $workspacePrefix . $referenceImage;
                        // 构建图片处理选项（如 crop 参数）
                        $linkOptions = [];
                        if (! empty($referenceImageOptions[$idx]['crop'])) {
                            $cropData = $referenceImageOptions[$idx]['crop'];
                            $imageProcessOptions = new ImageProcessOptions();
                            $imageProcessOptions->crop([
                                'width' => (int) round((float) ($cropData['width'] ?? 0)),
                                'height' => (int) round((float) ($cropData['height'] ?? 0)),
                                'x' => (int) round((float) ($cropData['x'] ?? 0)),
                                'y' => (int) round((float) ($cropData['y'] ?? 0)),
                            ]);
                            $linkOptions['image'] = $imageProcessOptions;
                        }
                        $imageUrl = $this->fileDomainService->getLink($dataIsolation->getCurrentOrganizationCode(), $fullReferenceImage, StorageBucketType::SandBox, [], $linkOptions)?->getUrl();
                        if ($imageUrl) {
                            $imageUrls[] = $imageUrl;
                        }
                    }
                    if (! empty($imageUrls)) {
                        $textGenerateImageDTO->setImages($imageUrls);
                    }

                    if ($imageGenerationEntity->getSize()) {
                        $textGenerateImageDTO->setSize($imageGenerationEntity->getSize());
                    }

                    $response = di(LLMAppService::class)->textGenerateImageV2($textGenerateImageDTO);
                    break;
                default:
            }
        }, 1000);
        return $response;
    }

    protected function createProjectFile(DesignDataIsolation $dataIsolation, ImageGenerationEntity $imageGenerationEntity, UploadFile $uploadFile): void
    {
        $contactDataIsolation = ContactDataIsolation::simpleMake($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());

        $project = $this->projectDomainService->getProjectNotUserId($imageGenerationEntity->getProjectId());
        if (! $project) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_generation.project_not_exists', ['project_id' => $imageGenerationEntity->getProjectId()]);
        }
        $filePrefix = $this->fileDomainService->getFullPrefix($dataIsolation->getCurrentOrganizationCode());

        $taskFileEntity = new TaskFileEntity();
        $taskFileEntity->setFileKey($imageGenerationEntity->getFullFilePath($filePrefix));
        $taskFileEntity->setSource(TaskFileSource::AI_IMAGE_GENERATION);
        $taskFileEntity->setFileName($imageGenerationEntity->getFileName());
        $taskFileEntity->setFileType(FileType::SYSTEM_AUTO_UPLOAD->name);
        $taskFileEntity->setFileSize($uploadFile->getSize());
        $taskFileEntity->setIsDirectory(false);
        $taskFileEntity->setParentId($imageGenerationEntity->getFileDirId());

        $this->taskFileDomainService->saveProjectFile(dataIsolation: $contactDataIsolation, projectEntity: $project, taskFileEntity: $taskFileEntity, isUpdated: false);
    }

    private function parseResponseUrl(OpenAIFormatResponse $response): string
    {
        // 目前我们只会生成一个，所以这里直接取第一个
        $data = $response->getData();
        if (isset($data[0]['url'])) {
            return $data[0]['url'];
        }
        return '';
    }

    /**
     * 根据 prompt 生成智能文件名.
     *
     * @param DesignDataIsolation $dataIsolation 数据隔离对象
     * @param ImageGenerationEntity $imageGenerationEntity 图片生成实体
     * @param string $prompt 用户输入的提示词
     * @return string 智能文件名（不含扩展名），成功时包含时间戳，失败时返回 image_id
     */
    private function generateIntelligentFileName(DesignDataIsolation $dataIsolation, ImageGenerationEntity $imageGenerationEntity, string $prompt): string
    {
        if ($imageGenerationEntity->getType() === ImageGenerationType::UPSCALE) {
            // 如果是转高清，用原来的文件名拼上 high_时间
            $originalFileName = pathinfo($imageGenerationEntity->getReferenceImages()[0], PATHINFO_FILENAME);

            // 如果文件名已经包含时间戳，先去掉
            // 匹配模式：_high_14位数字 或 _14位数字（时间戳格式：YmdHis）
            $originalFileName = preg_replace('/_high_\d{14}$/', '', $originalFileName);
            $originalFileName = preg_replace('/_\d{14}$/', '', $originalFileName);

            $timestamp = date('YmdHis');
            return $originalFileName . '_high_' . $timestamp;
        }

        if ($imageGenerationEntity->getType() === ImageGenerationType::REMOVE_BACKGROUND) {
            // 如果是去背景，用原来的文件名拼上 no_bg_时间
            $originalFileName = pathinfo($imageGenerationEntity->getReferenceImages()[0], PATHINFO_FILENAME);

            // 如果文件名已经包含时间戳，先去掉
            $originalFileName = preg_replace('/_no_bg_\d{14}$/', '', $originalFileName);
            $originalFileName = preg_replace('/_\d{14}$/', '', $originalFileName);

            $timestamp = date('YmdHis');
            return $originalFileName . '_no_bg_' . $timestamp;
        }

        if ($imageGenerationEntity->getType() === ImageGenerationType::ERASER) {
            // 橡皮擦，用原图文件名拼上 erased_时间
            $originalFileName = pathinfo($imageGenerationEntity->getReferenceImages()[0], PATHINFO_FILENAME);

            $originalFileName = preg_replace('/_erased_\d{14}$/', '', $originalFileName);
            $originalFileName = preg_replace('/_\d{14}$/', '', $originalFileName);

            $timestamp = date('YmdHis');
            return $originalFileName . '_erased_' . $timestamp;
        }

        if ($imageGenerationEntity->getType() === ImageGenerationType::EXPAND) {
            // 扩图，用画布图文件名拼上 expanded_时间
            $originalFileName = pathinfo($imageGenerationEntity->getReferenceImages()[0], PATHINFO_FILENAME);

            $originalFileName = preg_replace('/_expanded_\d{14}$/', '', $originalFileName);
            $originalFileName = preg_replace('/_\d{14}$/', '', $originalFileName);

            $timestamp = date('YmdHis');
            return $originalFileName . '_expanded_' . $timestamp;
        }

        // 如果 prompt 小于 10 个字符，直接使用 prompt 作为文件名
        if (mb_strlen($prompt) < 10) {
            $fileName = $this->sanitizeFileName($prompt);
            if (empty($fileName)) {
                return $imageGenerationEntity->getImageId();
            }
            $timestamp = date('YmdHis');
            return $fileName . '_' . $timestamp;
        }

        try {
            $agentFilePath = BASE_PATH . '/app/Application/Design/MicroAgent/ImageFileNameGenerator.agent.yaml';
            $nameGeneratorAgent = $this->microAgentFactory->getAgent('ImageFileNameGenerator', $agentFilePath);

            if (! $nameGeneratorAgent->isEnabled()) {
                // Agent 未启用，回退到 image_id
                $this->logger->warning('ImageFileNameGenerator agent is disabled, fallback to image_id');
                return $imageGenerationEntity->getImageId();
            }

            // 创建 ModelGateway 数据隔离（从 DesignDataIsolation 转换）
            $modelGatewayDataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);

            // 调用 Agent 生成文件名，失败后重试一次
            $fileName = '';
            retry(1, function () use (&$fileName, $nameGeneratorAgent, $modelGatewayDataIsolation, $prompt, $dataIsolation) {
                $response = $nameGeneratorAgent->easyCall(
                    dataIsolation: $modelGatewayDataIsolation,
                    userPrompt: "请为以下图片生成提示生成一个简洁的文件名：{$prompt}",
                    businessParams: [
                        'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                        'user_id' => $dataIsolation->getCurrentUserId(),
                        'source_id' => 'design_image_file_name_generation',
                    ]
                );

                $fileName = trim($response->getFirstChoice()?->getMessage()?->getContent() ?? '');
            }, 1000);

            if (empty($fileName)) {
                $this->logger->warning('ImageFileNameGenerator returned empty result, fallback to image_id');
                return $imageGenerationEntity->getImageId();
            }

            // 清理文件名：移除不合法字符，限制长度
            $fileName = $this->sanitizeFileName($fileName);

            if (empty($fileName)) {
                return $imageGenerationEntity->getImageId();
            }

            // 成功生成智能文件名，添加时间戳（格式：yyyyMMddHHmmss）
            $timestamp = date('YmdHis');
            return $fileName . '_' . $timestamp;
        } catch (Throwable $throwable) {
            // 异常时回退到 image_id
            $this->logger->warning('Failed to generate intelligent file name, fallback to image_id', [
                'error' => $throwable->getMessage(),
                'prompt' => $prompt,
            ]);
            return $imageGenerationEntity->getImageId();
        }
    }

    /**
     * 清理文件名，移除不合法字符.
     *
     * @param string $fileName 原始文件名
     * @return string 清理后的文件名
     */
    private function sanitizeFileName(string $fileName): string
    {
        // 移除 markdown 标记、引号等
        $fileName = preg_replace('/[`\'\"]+/', '', $fileName);
        // 移除文件系统不支持的字符
        $fileName = preg_replace('/[\/\\\:*?"<>|]+/', '_', $fileName);
        // 移除首尾空白
        $fileName = trim($fileName);
        // 限制长度（中文按3字节计算，限制30个字符约90字节）
        if (mb_strlen($fileName) > 30) {
            $fileName = mb_substr($fileName, 0, 30);
        }
        return $fileName;
    }
}
