<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\Facade;

use App\Application\Design\Service\DesignVideoAppService;
use App\Application\Design\Service\ImageConvertHighConfigAppService;
use App\Application\Design\Service\ImageGenerationAppService;
use App\Application\Design\Service\ImageMarkIdentifyAppService;
use App\Application\Design\Service\ImagePromptCompletionAppService;
use App\Application\Design\Service\TextContentCompletionAppService;
use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\Design\Entity\ValueObject\ImageGenerationType;
use App\Domain\Design\Entity\ValueObject\ImageMarkIdentifyType;
use App\Domain\ImageGenerate\ValueObject\ImageGenerationExpectedDuration;
use App\Interfaces\Design\Assembler\DesignVideoAssembler;
use App\Interfaces\Design\Assembler\ImageGenerationAssembler;
use App\Interfaces\Design\DTO\ImageGenerationDTO;
use App\Interfaces\Design\RequestForm\CompleteImagePromptFormRequest;
use App\Interfaces\Design\RequestForm\CompleteTextContentFormRequest;
use App\Interfaces\Design\RequestForm\ConvertHighImageFormRequest;
use App\Interfaces\Design\RequestForm\EraserFormRequest;
use App\Interfaces\Design\RequestForm\EstimateVideoPointsFormRequest;
use App\Interfaces\Design\RequestForm\ExpandImageFormRequest;
use App\Interfaces\Design\RequestForm\GenerateImageFormRequest;
use App\Interfaces\Design\RequestForm\GenerateImagesFormRequest;
use App\Interfaces\Design\RequestForm\GenerateVideoFormRequest;
use App\Interfaces\Design\RequestForm\IdentifyImageMarkFormRequest;
use App\Interfaces\Design\RequestForm\QueryImageGenerationResultFormRequest;
use App\Interfaces\Design\RequestForm\QueryVideoGenerationResultFormRequest;
use App\Interfaces\Design\RequestForm\RemoveBackgroundFormRequest;
use DateTimeInterface;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class DesignApi extends AbstractApi
{
    #[Inject]
    protected ImageGenerationAppService $imageGenerationAppService;

    #[Inject]
    protected ImageMarkIdentifyAppService $imageMarkIdentifyAppService;

    #[Inject]
    protected ImagePromptCompletionAppService $imagePromptCompletionAppService;

    #[Inject]
    protected TextContentCompletionAppService $textContentCompletionAppService;

    #[Inject]
    protected ImageConvertHighConfigAppService $imageConvertHighConfigAppService;

    #[Inject]
    protected DesignVideoAppService $designVideoAppService;

    /**
     * 生成图片.
     */
    public function generateImage(GenerateImageFormRequest $request)
    {
        $request->validateResolved();
        $authenticatable = $this->getAuthorization();
        $validated = $request->validated();
        $dto = new ImageGenerationDTO($validated);

        $DO = ImageGenerationAssembler::toDO($dto);

        $DO->setType(ImageGenerationType::TEXT_TO_IMAGE);
        if ($DO->getReferenceImageCount()) {
            $DO->setType(ImageGenerationType::IMAGE_TO_IMAGE);
        }

        $entity = $this->imageGenerationAppService->generateImage($authenticatable, $DO);

        return ImageGenerationAssembler::toDTO($entity);
    }

    /**
     * 生成多张图片.
     */
    public function generateImages(GenerateImagesFormRequest $request)
    {
        $request->validateResolved();
        $authenticatable = $this->getAuthorization();
        $validated = $request->validated();
        $dto = new ImageGenerationDTO($validated);

        $DO = ImageGenerationAssembler::toDO($dto);
        $DO->setGenerateNum((int) $validated['generate_num']);

        $DO->setType(ImageGenerationType::TEXT_TO_IMAGE);
        if ($DO->getReferenceImageCount()) {
            $DO->setType(ImageGenerationType::IMAGE_TO_IMAGE);
        }

        $entity = $this->imageGenerationAppService->generateImages($authenticatable, $DO);

        return $this->formatImageGenerationResults($entity);
    }

    /**
     * 转高清.
     */
    public function generateHighImage(ConvertHighImageFormRequest $request)
    {
        $request->validateResolved();
        $authenticatable = $this->getAuthorization();
        $dto = new ImageGenerationDTO($this->normalizeImageOperationPayload($request->validated()));
        $DO = ImageGenerationAssembler::toDO($dto);

        $filePath = (string) $this->request->input('file_path');
        // 转高清需要设置源图片路径作为参考图
        $DO->setReferenceImages([$filePath]);

        $referenceImageOptions = $this->request->input('reference_image_options');
        if (! empty($referenceImageOptions) && is_array($referenceImageOptions)) {
            $DO->setReferenceImageOptions($referenceImageOptions);
        }

        $resultEntity = $this->imageGenerationAppService->generateHighImage($authenticatable, $DO);

        return ImageGenerationAssembler::toDTO($resultEntity);
    }

    /**
     * 查询图片生成结果.
     */
    public function queryImageGenerationResult(QueryImageGenerationResultFormRequest $request)
    {
        $authenticatable = $this->getAuthorization();

        $request->validateResolved();
        $validated = $request->validated();
        $projectId = (int) $validated['project_id'];
        $imageId = (string) $validated['image_id'];

        $entity = $this->imageGenerationAppService->queryImageGeneration($authenticatable, $projectId, $imageId);

        return ImageGenerationAssembler::toDTO($entity);
    }

    /**
     * 查询多图生成结果.
     */
    public function queryImageGenerationResults(QueryImageGenerationResultFormRequest $request)
    {
        $authenticatable = $this->getAuthorization();

        $request->validateResolved();
        $validated = $request->validated();
        $projectId = (int) $validated['project_id'];
        $imageId = (string) $validated['image_id'];

        $entity = $this->imageGenerationAppService->queryImageGenerationResults($authenticatable, $projectId, $imageId);

        return $this->formatImageGenerationResults($entity);
    }

    /**
     * 识别图片标记位置的内容.
     */
    public function identifyImageMark(IdentifyImageMarkFormRequest $request)
    {
        $authenticatable = $this->getAuthorization();
        $request->validateResolved();
        $validated = $request->validated();
        $projectId = (int) $validated['project_id'];
        $filePath = (string) $validated['file_path'];
        $type = ImageMarkIdentifyType::make($validated['type'] ?? null);
        $number = isset($validated['number']) ? (int) $validated['number'] : null;
        $mark = ! empty($validated['mark']) ? (array) $validated['mark'] : null;
        $area = ! empty($validated['area']) ? (array) $validated['area'] : null;

        $result = $this->imageMarkIdentifyAppService->identifyImageMark(
            $authenticatable,
            $projectId,
            $filePath,
            $type,
            $number,
            $mark,
            $area
        );

        $response = [
            'project_id' => (string) $projectId,
            'file_path' => $filePath,
            'type' => $type->value,
            'suggestion' => $result['suggestion'],
            'suggestions' => $result['suggestions'],
        ];

        // 根据传入参数返回相应字段
        if ($number !== null) {
            $response['number'] = $number;
        }
        if ($mark !== null) {
            $response['mark'] = $mark;
        }
        if ($area !== null) {
            $response['area'] = $area;
        }

        return $response;
    }

    /**
     * 补全生图提示词.
     */
    public function completeImagePrompt(CompleteImagePromptFormRequest $request): array
    {
        $authenticatable = $this->getAuthorization();
        $request->validateResolved();
        $validated = $request->validated();

        $prompt = $this->imagePromptCompletionAppService->complete(
            $authenticatable,
            (int) $validated['project_id'],
            (string) $validated['user_prompt'],
            isset($validated['model_id']) ? (string) $validated['model_id'] : null,
            isset($validated['reference_images']) ? (array) $validated['reference_images'] : [],
            isset($validated['reference_image_options']) ? (array) $validated['reference_image_options'] : [],
        );

        return ['prompt' => $prompt];
    }

    /**
     * 优化画布文本内容.
     */
    public function completeTextContent(CompleteTextContentFormRequest $request): array
    {
        $authenticatable = $this->getAuthorization();
        $request->validateResolved();
        $validated = $request->validated();

        $text = $this->textContentCompletionAppService->complete(
            $authenticatable,
            (int) $validated['project_id'],
            (string) $validated['user_prompt'],
            isset($validated['model_id']) ? (string) $validated['model_id'] : null,
        );

        return ['text' => $text];
    }

    /**
     * 橡皮擦（原图 + 标记图，擦除标记区域）.
     */
    public function eraser(EraserFormRequest $request)
    {
        $request->validateResolved();
        $authenticatable = $this->getAuthorization();
        $dto = new ImageGenerationDTO($this->normalizeImageOperationPayload($request->validated()));
        $DO = ImageGenerationAssembler::toDO($dto);

        $filePath = (string) $this->request->input('file_path');
        $markPath = (string) $this->request->input('mark_path');
        // 原图作为第一张参考图，标记图作为第二张参考图
        $DO->setReferenceImages([$filePath, $markPath]);

        $referenceImageOptions = $this->request->input('reference_image_options');
        if (! empty($referenceImageOptions) && is_array($referenceImageOptions)) {
            $DO->setReferenceImageOptions($referenceImageOptions);
        }

        $resultEntity = $this->imageGenerationAppService->generateEraser($authenticatable, $DO);

        return ImageGenerationAssembler::toDTO($resultEntity);
    }

    /**
     * 扩图（扩展画布图 + mask 图，由模型填充扩展区域）.
     */
    public function expandImage(ExpandImageFormRequest $request)
    {
        $request->validateResolved();
        $authenticatable = $this->getAuthorization();
        $dto = new ImageGenerationDTO($this->normalizeImageOperationPayload($request->validated()));
        $DO = ImageGenerationAssembler::toDO($dto);

        $filePath = (string) $this->request->input('file_path');
        $canvasPath = (string) $this->request->input('canvas_path');
        $maskPath = (string) $this->request->input('mask_path');
        // 原图、扩展画布图、mask 图依次作为三张参考图
        $DO->setReferenceImages([$filePath, $canvasPath, $maskPath]);

        $referenceImageOptions = $this->request->input('reference_image_options');
        if (! empty($referenceImageOptions) && is_array($referenceImageOptions)) {
            $DO->setReferenceImageOptions($referenceImageOptions);
        }

        $resultEntity = $this->imageGenerationAppService->generateExpandImage($authenticatable, $DO);

        return ImageGenerationAssembler::toDTO($resultEntity);
    }

    /**
     * 去背景.
     */
    public function removeBackground(RemoveBackgroundFormRequest $request)
    {
        $request->validateResolved();
        $authenticatable = $this->getAuthorization();
        $dto = new ImageGenerationDTO($request->validated());
        $DO = ImageGenerationAssembler::toDO($dto);

        $filePath = (string) $this->request->input('file_path');
        // 将源图片路径设置为参考图
        $DO->setReferenceImages([$filePath]);

        $referenceImageOptions = $this->request->input('reference_image_options');
        if (! empty($referenceImageOptions) && is_array($referenceImageOptions)) {
            $DO->setReferenceImageOptions($referenceImageOptions);
        }

        $resultEntity = $this->imageGenerationAppService->generateRemoveBackground($authenticatable, $DO);

        return ImageGenerationAssembler::toDTO($resultEntity);
    }

    /**
     * Get image convert high definition config endpoint.
     *
     * GET /api/v1/design/convert-high/config
     *
     * @deprecated use GET /api/v1/ai-abilities/availability instead
     * @return array response with supported status and convert high image size configuration
     */
    public function imageConvertHighConfig(): array
    {
        return $this->imageConvertHighConfigAppService->getImageConvertHighConfig()->toArray();
    }

    /**
     * 生成视频.
     */
    public function generateVideo(GenerateVideoFormRequest $request): array
    {
        $request->validateResolved();
        $authenticatable = $this->getAuthorization();
        $dto = new DesignVideoCreateDTO($request->validated());
        $entity = DesignVideoAssembler::toDO($dto);

        $entity = $this->designVideoAppService->create($authenticatable, $entity);

        return DesignVideoAssembler::toDTO($entity)->toArray();
    }

    public function estimateVideoPoints(EstimateVideoPointsFormRequest $request): array
    {
        $request->validateResolved();
        $authenticatable = $this->getAuthorization();
        $dto = new DesignVideoCreateDTO($request->validated());

        return $this->designVideoAppService->estimatePoints($authenticatable, $dto)->toArray();
    }

    /**
     * 查询视频生成结果.
     */
    public function queryVideoGenerationResult(QueryVideoGenerationResultFormRequest $request): array
    {
        $request->validateResolved();
        $authenticatable = $this->getAuthorization();
        $validated = $request->validated();
        $projectId = (int) $validated['project_id'];
        $videoId = (string) $validated['video_id'];

        $entity = $this->designVideoAppService->query($authenticatable, $projectId, $videoId);

        return DesignVideoAssembler::toDTO($entity)->toArray();
    }

    private function formatImageGenerationResults(ImageGenerationEntity $entity): array
    {
        return [
            'project_id' => (string) $entity->getProjectId(),
            'image_id' => $entity->getImageId(),
            'model_id' => $entity->getModelId(),
            'prompt' => $entity->getPrompt(),
            'size' => $entity->getSize(),
            'resolution' => $entity->getResolution(),
            'file_dir' => $entity->getFileDir(),
            'generate_num' => $entity->getGenerateNum(),
            'status' => $entity->getStatus()->value,
            'error_message' => $entity->getErrorMessage(),
            'images' => $entity->getImages(),
            // 成对下发任务起止时间，供画布和工具卡使用同一进度口径。
            'started_at' => date(
                DateTimeInterface::ATOM,
                $entity->getCreatedAt()->getTimestamp()
            ),
            'expected_finished_at' => date(
                DateTimeInterface::ATOM,
                $entity->getCreatedAt()->getTimestamp() + ImageGenerationExpectedDuration::resolveSeconds(
                    $entity->getResolution(),
                    $entity->getSize()
                )
            ),
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function normalizeImageOperationPayload(array $payload): array
    {
        if (! isset($payload['image_generation_config']) && isset($payload['generate_config'])) {
            $payload['image_generation_config'] = $payload['generate_config'];
        }
        unset($payload['generate_config']);

        if (! isset($payload['prompt']) && isset($payload['custom_prompt'])) {
            $payload['prompt'] = $payload['custom_prompt'];
        }
        unset($payload['custom_prompt']);

        return $payload;
    }
}
