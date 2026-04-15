<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Design;

use App\Domain\Design\Contract\VideoGatewayPayloadBuilderInterface;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Factory\PathFactory;
use App\Domain\File\Service\FileDomainService;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;

readonly class VideoGatewayPayloadBuilder implements VideoGatewayPayloadBuilderInterface
{
    private const string DATA_URL_TEMPLATE = 'data:%s;base64,%s';

    private const string TEMP_FILE_PREFIX = 'design-video-';

    private const string INPUT_KEY_VIDEO = 'video';

    private const string INPUT_KEY_MASK = 'mask';

    private const string INPUT_KEY_REFERENCE_IMAGES = 'reference_images';

    private const string INPUT_KEY_FRAMES = 'frames';

    private const string INPUT_KEY_AUDIO = 'audio';

    private const string FIELD_URI = 'uri';

    private const string FIELD_ROLE = 'role';

    private const string FIELD_TYPE = 'type';

    private const string AUDIO_ROLE_REFERENCE = 'reference';

    private const string ERROR_VIDEO_INPUT_URL_MISSING = 'design.video_generation.video_input_url_missing';

    private const string ERROR_REFERENCE_IMAGE_URL_MISSING = 'design.video_generation.reference_image_url_missing';

    private const string ERROR_FRAME_URL_MISSING = 'design.video_generation.frame_url_missing';

    public function __construct(
        private FileDomainService $fileDomainService,
    ) {
    }

    public function build(DesignGenerationTaskEntity $entity): array
    {
        $payload = $entity->getRequestPayload();
        $payload['inputs'] = $this->buildInputs($entity);

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildInputs(DesignGenerationTaskEntity $entity): array
    {
        $filePrefix = $this->fileDomainService->getFullPrefix($entity->getOrganizationCode());
        $workspacePrefix = PathFactory::getWorkspacePrefix($filePrefix, $entity->getProjectId());

        $video = [];
        if ($entity->getVideo() !== null) {
            $fullPath = $workspacePrefix . $entity->getVideo();
            $url = $this->fileDomainService->getLink($entity->getOrganizationCode(), $fullPath, StorageBucketType::SandBox)?->getUrl();
            if (! $url) {
                ExceptionBuilder::throw(
                    DesignErrorCode::ThirdPartyServiceError,
                    self::ERROR_VIDEO_INPUT_URL_MISSING,
                    ['file_key' => $entity->getVideo()]
                );
            }
            $video = [self::FIELD_URI => $url];
        }

        $mask = [];
        if ($entity->getMask() !== null) {
            $fullPath = $workspacePrefix . $entity->getMask();
            $url = $this->fileDomainService->getLink($entity->getOrganizationCode(), $fullPath, StorageBucketType::SandBox)?->getUrl();
            if (! $url) {
                ExceptionBuilder::throw(
                    DesignErrorCode::ThirdPartyServiceError,
                    self::ERROR_VIDEO_INPUT_URL_MISSING,
                    ['file_key' => $entity->getMask()]
                );
            }
            $mask = [self::FIELD_URI => $url];
        }

        $referenceImages = [];
        foreach ($entity->getReferenceImages() as $referenceImage) {
            $relativePath = (string) ($referenceImage[self::FIELD_URI] ?? '');
            $fullPath = $workspacePrefix . $relativePath;
            $item = [self::FIELD_URI => $this->buildImageDataUrl(
                $entity->getOrganizationCode(),
                $fullPath,
                $relativePath,
                self::ERROR_REFERENCE_IMAGE_URL_MISSING,
            )];
            $type = trim((string) ($referenceImage[self::FIELD_TYPE] ?? ''));
            if ($type !== '') {
                $item[self::FIELD_TYPE] = $type;
            }
            $referenceImages[] = $item;
        }

        $frames = [];
        foreach ($entity->getFrames() as $frame) {
            $uri = (string) ($frame[self::FIELD_URI] ?? '');
            $role = (string) ($frame[self::FIELD_ROLE] ?? '');
            $fullPath = $workspacePrefix . $uri;
            $frames[] = [
                self::FIELD_ROLE => $role,
                self::FIELD_URI => $this->buildImageDataUrl(
                    $entity->getOrganizationCode(),
                    $fullPath,
                    $uri,
                    self::ERROR_FRAME_URL_MISSING,
                ),
            ];
        }

        $audio = [];
        foreach ($entity->getAudioInputs() as $item) {
            $uri = (string) ($item[self::FIELD_URI] ?? '');
            $fullPath = $workspacePrefix . $uri;
            $url = $this->fileDomainService->getLink($entity->getOrganizationCode(), $fullPath, StorageBucketType::SandBox)?->getUrl();
            if (! $url) {
                ExceptionBuilder::throw(
                    DesignErrorCode::ThirdPartyServiceError,
                    self::ERROR_VIDEO_INPUT_URL_MISSING,
                    ['file_key' => $uri]
                );
            }
            $audio[] = [
                self::FIELD_ROLE => (string) ($item[self::FIELD_ROLE] ?? self::AUDIO_ROLE_REFERENCE),
                self::FIELD_URI => $url,
            ];
        }

        return array_filter([
            self::INPUT_KEY_VIDEO => $video,
            self::INPUT_KEY_MASK => $mask,
            self::INPUT_KEY_REFERENCE_IMAGES => $referenceImages,
            self::INPUT_KEY_FRAMES => $frames,
            self::INPUT_KEY_AUDIO => $audio,
        ], static fn (array $value): bool => $value !== []);
    }

    private function buildImageDataUrl(
        string $organizationCode,
        string $fullPath,
        string $fileKey,
        string $errorKey,
    ): string {
        $tempPath = tempnam(sys_get_temp_dir(), self::TEMP_FILE_PREFIX);
        if ($tempPath === false) {
            ExceptionBuilder::throw(
                DesignErrorCode::ThirdPartyServiceError,
                $errorKey,
                ['file_key' => $fileKey]
            );
        }

        try {
            $this->fileDomainService->downloadByChunks($organizationCode, $fullPath, $tempPath, StorageBucketType::SandBox);
            $content = file_get_contents($tempPath);
            if (! is_string($content) || $content === '') {
                ExceptionBuilder::throw(
                    DesignErrorCode::ThirdPartyServiceError,
                    $errorKey,
                    ['file_key' => $fileKey]
                );
            }

            return sprintf(
                self::DATA_URL_TEMPLATE,
                $this->guessImageMimeType($fileKey),
                base64_encode($content),
            );
        } finally {
            @unlink($tempPath);
        }
    }

    private function guessImageMimeType(string $filePath): string
    {
        return match (strtolower(pathinfo($filePath, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'bmp' => 'image/bmp',
            'avif' => 'image/avif',
            default => 'image/png',
        };
    }
}
