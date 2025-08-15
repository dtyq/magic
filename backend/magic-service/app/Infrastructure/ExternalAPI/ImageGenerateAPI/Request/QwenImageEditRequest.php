<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

class QwenImageEditRequest extends ImageGenerateRequest
{
    protected array $imageUrls = [];

    protected string $editType = '';

    protected ?string $maskUrl = null;

    protected array $editParams = [];

    protected string $organizationCode = '';

    protected string $refImageType = 'url';  // url, base64

    public function __construct(
        string $prompt = '',
        string $editType = '',
        array $imageUrls = [],
        string $model = 'wanx-image-edit',
    ) {
        parent::__construct('', '', $prompt, '', $model);
        $this->editType = $editType;
        $this->imageUrls = $imageUrls;
    }

    public function getImageUrls(): array
    {
        return $this->imageUrls;
    }

    public function setImageUrls(array $imageUrls): void
    {
        $this->imageUrls = $imageUrls;
    }

    public function getEditType(): string
    {
        return $this->editType;
    }

    public function setEditType(string $editType): void
    {
        $this->editType = $editType;
    }

    public function getMaskUrl(): ?string
    {
        return $this->maskUrl;
    }

    public function setMaskUrl(?string $maskUrl): void
    {
        $this->maskUrl = $maskUrl;
    }

    public function getEditParams(): array
    {
        return $this->editParams;
    }

    public function setEditParams(array $editParams): void
    {
        $this->editParams = $editParams;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getRefImageType(): string
    {
        return $this->refImageType;
    }

    public function setRefImageType(string $refImageType): void
    {
        $this->refImageType = $refImageType;
    }

    /**
     * 设置风格化编辑参数.
     */
    public function setStyleEditParams(string $style = '', float $strength = 0.5): void
    {
        $this->editParams = [
            'style' => $style,
            'strength' => $strength,
        ];
    }

    /**
     * 设置超分辨率编辑参数.
     */
    public function setSuperResolutionParams(int $scale = 2): void
    {
        $this->editParams = [
            'scale' => $scale,
        ];
    }

    /**
     * 设置图像扩展参数.
     */
    public function setImageExpansionParams(string $direction = 'all', int $ratio = 1): void
    {
        $this->editParams = [
            'direction' => $direction,
            'ratio' => $ratio,
        ];
    }

    public function toArray(): array
    {
        return [
            'prompt' => $this->getPrompt(),
            'edit_type' => $this->editType,
            'image_urls' => $this->imageUrls,
            'mask_url' => $this->maskUrl,
            'edit_params' => $this->editParams,
            'ref_image_type' => $this->refImageType,
            'model' => $this->getModel(),
            'organization_code' => $this->organizationCode,
        ];
    }
}
