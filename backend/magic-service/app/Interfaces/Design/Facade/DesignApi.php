<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\Facade;

use App\Application\Design\Service\ImageConvertHighConfigAppService;
use App\Application\Design\Service\ImageGenerationAppService;
use App\Application\Design\Service\ImageMarkIdentifyAppService;
use App\Domain\Design\Entity\ValueObject\ImageGenerationType;
use App\Domain\Design\Entity\ValueObject\ImageMarkIdentifyType;
use App\Interfaces\Design\Assembler\ImageGenerationAssembler;
use App\Interfaces\Design\DTO\ImageGenerationDTO;
use App\Interfaces\Design\RequestForm\ConvertHighImageFormRequest;
use App\Interfaces\Design\RequestForm\EraserFormRequest;
use App\Interfaces\Design\RequestForm\ExpandImageFormRequest;
use App\Interfaces\Design\RequestForm\GenerateImageFormRequest;
use App\Interfaces\Design\RequestForm\IdentifyImageMarkFormRequest;
use App\Interfaces\Design\RequestForm\QueryImageGenerationResultFormRequest;
use App\Interfaces\Design\RequestForm\RemoveBackgroundFormRequest;
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
    protected ImageConvertHighConfigAppService $imageConvertHighConfigAppService;

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

        // 若前端传入了原图裁剪参数，记录到第 0 张参考图的处理选项中
        $crop = $this->request->input('crop');
        if (! empty($crop) && is_array($crop)) {
            $DO->setReferenceImageOptions([0 => ['crop' => $crop]]);
        }

        $entity = $this->imageGenerationAppService->generateImage($authenticatable, $DO);

        return ImageGenerationAssembler::toDTO($entity);
    }

    /**
     * 转高清.
     */
    public function generateHighImage(ConvertHighImageFormRequest $request)
    {
        $request->validateResolved();
        $authenticatable = $this->getAuthorization();
        $dto = new ImageGenerationDTO($request->validated());
        $DO = ImageGenerationAssembler::toDO($dto);

        $filePath = (string) $this->request->input('file_path');
        // 转高清需要设置源图片路径作为参考图
        $DO->setReferenceImages([$filePath]);

        // 若前端传入了原图裁剪参数，记录到第 0 张参考图的处理选项中
        $crop = $this->request->input('crop');
        if (! empty($crop) && is_array($crop)) {
            $DO->setReferenceImageOptions([0 => ['crop' => $crop]]);
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
     * 橡皮擦（原图 + 标记图，擦除标记区域）.
     */
    public function eraser(EraserFormRequest $request)
    {
        $request->validateResolved();
        $authenticatable = $this->getAuthorization();
        $dto = new ImageGenerationDTO($request->validated());
        $DO = ImageGenerationAssembler::toDO($dto);

        $filePath = (string) $this->request->input('file_path');
        $markPath = (string) $this->request->input('mark_path');
        // 原图作为第一张参考图，标记图作为第二张参考图
        $DO->setReferenceImages([$filePath, $markPath]);

        // 若前端传入了原图裁剪参数，记录到第 0 张参考图的处理选项中
        $crop = $this->request->input('crop');
        if (! empty($crop) && is_array($crop)) {
            $DO->setReferenceImageOptions([0 => ['crop' => $crop]]);
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
        $dto = new ImageGenerationDTO($request->validated());
        $DO = ImageGenerationAssembler::toDO($dto);

        $filePath = (string) $this->request->input('file_path');
        $canvasPath = (string) $this->request->input('canvas_path');
        $maskPath = (string) $this->request->input('mask_path');
        // 原图、扩展画布图、mask 图依次作为三张参考图
        $DO->setReferenceImages([$filePath, $canvasPath, $maskPath]);

        // 若前端传入了原图裁剪参数，记录到第 0 张参考图的处理选项中
        $crop = $this->request->input('crop');
        if (! empty($crop) && is_array($crop)) {
            $DO->setReferenceImageOptions([0 => ['crop' => $crop]]);
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

        // 若前端传入了裁剪参数，记录到第 0 张参考图的处理选项中
        $crop = $this->request->input('crop');
        if (! empty($crop) && is_array($crop)) {
            $DO->setReferenceImageOptions([0 => ['crop' => $crop]]);
        }

        $resultEntity = $this->imageGenerationAppService->generateRemoveBackground($authenticatable, $DO);

        return ImageGenerationAssembler::toDTO($resultEntity);
    }

    /**
     * Get image convert high definition config endpoint.
     *
     * GET /api/v1/design/convert-high/config
     *
     * @return array Response with convert high config (supported status and sizes)
     */
    public function imageConvertHighConfig(): array
    {
        return $this->imageConvertHighConfigAppService->getImageConvertHighConfig()->toArray();
    }
}
