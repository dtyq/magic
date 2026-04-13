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

final class UploadProcessor implements ImageProcessorInterface
{
    public function __construct(
        private readonly FileDomainService $fileDomainService,
    ) {
    }

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
        if (is_file($context->getLocalFilePath())) {
            $imageInfo = @getimagesize($context->getLocalFilePath());
            if (is_array($imageInfo) && ! empty($imageInfo['mime'])) {
                return $imageInfo['mime'];
            }
        }

        return $context->getMimeType();
    }
}
