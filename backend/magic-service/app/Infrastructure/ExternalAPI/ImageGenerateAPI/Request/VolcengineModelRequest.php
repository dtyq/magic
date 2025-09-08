<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

class VolcengineModelRequest extends ImageGenerateRequest
{
    // 内置的超分功能，开启后可将上述宽高均乘以2返回，此参数打开后延迟会有增加
    // 如上述宽高均为512和512，此参数关闭出图 512*512 ，此参数打开出图1024 * 1024
    private bool $useSr = false;

    // 目前只支持 url
    private array $referenceImages = [];

    public function __construct(string $width = '512', string $height = '512', string $prompt = '', string $negativePrompt = '')
    {
        parent::__construct($width, $height, $prompt, $negativePrompt);
    }

    public function getUseSr(): bool
    {
        return $this->useSr;
    }

    public function setUseSr(bool $useSr): void
    {
        $this->useSr = $useSr;
    }

    public function getReferenceImage(): array
    {
        return $this->referenceImages;
    }

    public function setReferenceImage(array $referenceImages): void
    {
        $this->referenceImages = $referenceImages;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }
}
