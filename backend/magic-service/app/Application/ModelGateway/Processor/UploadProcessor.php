<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Processor;

use App\Application\ModelGateway\Struct\ImageProcessContext;
use App\Domain\File\Service\FileDomainService;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\MimeTypes;

use function Hyperf\Translation\__;

/**
 * 将当前上下文中的本地结果图上传到 OSS，并把最终访问地址回填到上下文。
 */
final class UploadProcessor implements ImageProcessorInterface
{
    public function __construct(
        private readonly FileDomainService $fileDomainService,
    ) {
    }

    /**
     * 上传结果图并记录最终对外可见的 URL/mime 信息。
     */
    public function process(ImageProcessContext $context): void
    {
        $mimeType = $this->detectMimeType($context);
        $uploadFile = new UploadFile(
            $context->getLocalFilePath(),
            $context->getStorageSubDir(),
            $this->buildUploadFileName($context, $mimeType),
        );

        $organizationCode = $context->getOrganizationCode();
        $this->fileDomainService->uploadByCredential(
            $organizationCode,
            $uploadFile,
            StorageBucketType::Public,
            true,
            $mimeType,
        );

        $fileLink = $this->fileDomainService->getLink(
            $organizationCode,
            $uploadFile->getKey(),
            StorageBucketType::Public,
        );

        if ($fileLink === null || $fileLink->getUrl() === '') {
            ExceptionBuilder::throw(
                MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                __('image_generate.file_upload_failed', ['error' => 'result_url_missing'])
            );
        }

        $context->setUploadedUrl($fileLink->getUrl());
        $context->setUploadedMimeType($mimeType);
    }

    private function buildUploadFileName(
        ImageProcessContext $context,
        string $mimeType,
    ): string {
        // 尽量保留正确扩展名，避免最终 OSS 地址没有可识别的后缀。
        $extension = MimeTypes::getExtension($mimeType);
        if ($extension === '') {
            $extension = pathinfo($context->getLocalFilePath(), PATHINFO_EXTENSION);
        }
        if ($extension === '') {
            $extension = 'png';
        }

        return sprintf('%s_%s.%s', $context->getUploadFileNamePrefix(), uniqid(), $extension);
    }

    private function detectMimeType(ImageProcessContext $context): string
    {
        // 上传前优先重新探测一次，确保经过水印处理后的文件类型与上下文一致。
        if (is_file($context->getLocalFilePath())) {
            $imageInfo = @getimagesize($context->getLocalFilePath());
            if (is_array($imageInfo) && ! empty($imageInfo['mime'])) {
                return $imageInfo['mime'];
            }
        }

        return $context->getMimeType();
    }
}
