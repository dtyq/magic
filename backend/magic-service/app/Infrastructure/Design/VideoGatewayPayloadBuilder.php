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

    private const string INPUT_KEY_MASK = 'mask';

    private const string INPUT_KEY_REFERENCE_IMAGES = 'reference_images';

    private const string INPUT_KEY_REFERENCE_VIDEOS = 'reference_videos';

    private const string INPUT_KEY_REFERENCE_AUDIOS = 'reference_audios';

    private const string INPUT_KEY_FRAMES = 'frames';

    private const string FIELD_URI = 'uri';

    private const string FIELD_ROLE = 'role';

    private const string FIELD_TYPE = 'type';

    // 由上游根据模型能力预先写入，决定图片输入走 URL 还是 data URL。
    private const string FIELD_SUPPORTS_IMAGE_INPUT_URL = 'supports_image_input_url';

    private const string ERROR_REFERENCE_MEDIA_URL_MISSING = 'design.video_generation.video_input_url_missing';

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
        $payload['prompt'] = $this->rewritePromptReferenceMentions(
            (string) ($payload['prompt'] ?? ''),
            (string) ($payload['input_mode'] ?? ''),
            is_array($entity->getRequestPayload()['inputs'] ?? null) ? $entity->getRequestPayload()['inputs'] : [],
        );

        return $payload;
    }

    public function supportsImageInputUrl(DesignGenerationTaskEntity $entity): bool
    {
        return (bool) ($entity->getRequestPayload()[self::FIELD_SUPPORTS_IMAGE_INPUT_URL] ?? false);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildInputs(DesignGenerationTaskEntity $entity): array
    {
        $filePrefix = $this->fileDomainService->getFullPrefix($entity->getOrganizationCode());
        $workspacePrefix = PathFactory::getWorkspacePrefix($filePrefix, $entity->getProjectId());
        // VolcengineArk 这类支持图片直链的模型直接走 URL，避免无谓的 base64 转换。
        $supportsImageInputUrl = $this->supportsImageInputUrl($entity);

        $mask = [];
        if ($entity->getMask() !== null) {
            $fullPath = $workspacePrefix . $entity->getMask();
            $url = $this->fileDomainService->getLink($entity->getOrganizationCode(), $fullPath, StorageBucketType::SandBox)?->getUrl();
            if (! $url) {
                ExceptionBuilder::throw(
                    DesignErrorCode::ThirdPartyServiceError,
                    self::ERROR_REFERENCE_MEDIA_URL_MISSING,
                    ['file_key' => $entity->getMask()]
                );
            }
            $mask = [self::FIELD_URI => $url];
        }

        $referenceImages = [];
        foreach ($entity->getReferenceImages() as $referenceImage) {
            $relativePath = (string) ($referenceImage[self::FIELD_URI] ?? '');
            $fullPath = $workspacePrefix . $relativePath;
            $item = [self::FIELD_URI => $supportsImageInputUrl
                ? $this->buildImageUrl(
                    $entity->getOrganizationCode(),
                    $fullPath,
                    $relativePath,
                    self::ERROR_REFERENCE_IMAGE_URL_MISSING,
                )
                : $this->buildImageDataUrl(
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
                self::FIELD_URI => $supportsImageInputUrl
                    ? $this->buildImageUrl(
                        $entity->getOrganizationCode(),
                        $fullPath,
                        $uri,
                        self::ERROR_FRAME_URL_MISSING,
                    )
                    : $this->buildImageDataUrl(
                        $entity->getOrganizationCode(),
                        $fullPath,
                        $uri,
                        self::ERROR_FRAME_URL_MISSING,
                    ),
            ];
        }

        $referenceVideos = [];
        foreach ($entity->getReferenceVideos() as $referenceVideo) {
            $uri = (string) ($referenceVideo[self::FIELD_URI] ?? '');
            if ($uri === '') {
                continue;
            }

            $fullPath = $workspacePrefix . $uri;
            $referenceVideos[] = [self::FIELD_URI => $this->buildImageUrl(
                $entity->getOrganizationCode(),
                $fullPath,
                $uri,
                self::ERROR_REFERENCE_MEDIA_URL_MISSING,
            )];
        }

        $referenceAudios = [];
        foreach ($entity->getReferenceAudios() as $referenceAudio) {
            $uri = (string) ($referenceAudio[self::FIELD_URI] ?? '');
            if ($uri === '') {
                continue;
            }

            $fullPath = $workspacePrefix . $uri;
            $url = $this->fileDomainService->getLink($entity->getOrganizationCode(), $fullPath, StorageBucketType::SandBox)?->getUrl();
            if (! $url) {
                ExceptionBuilder::throw(
                    DesignErrorCode::ThirdPartyServiceError,
                    self::ERROR_REFERENCE_MEDIA_URL_MISSING,
                    ['file_key' => $uri]
                );
            }
            $referenceAudios[] = [self::FIELD_URI => $url];
        }

        return array_filter([
            self::INPUT_KEY_MASK => $mask,
            self::INPUT_KEY_REFERENCE_IMAGES => $referenceImages,
            self::INPUT_KEY_REFERENCE_VIDEOS => $referenceVideos,
            self::INPUT_KEY_REFERENCE_AUDIOS => $referenceAudios,
            self::INPUT_KEY_FRAMES => $frames,
        ], static fn (array $value): bool => $value !== []);
    }

    /**
     * 真正发起 submit 前，先构造“素材索引”，再把 prompt 中对文件名的引用改成稳定占位，
     * 避免 provider 误解中文文件名，同时让模型先建立“图片1/视频1/音频1”的素材映射。
     *
     * @param array<string, mixed> $rawInputs
     */
    private function rewritePromptReferenceMentions(string $prompt, string $inputMode, array $rawInputs): string
    {
        if (! in_array(trim($inputMode), ['omni_reference', 'image_reference'], true)) {
            return $prompt;
        }

        $referenceMappings = array_merge(
            $this->buildReferenceMentionMappings(
                is_array($rawInputs[self::INPUT_KEY_REFERENCE_IMAGES] ?? null) ? $rawInputs[self::INPUT_KEY_REFERENCE_IMAGES] : [],
                '图片',
            ),
            $this->buildReferenceMentionMappings(
                is_array($rawInputs[self::INPUT_KEY_REFERENCE_VIDEOS] ?? null) ? $rawInputs[self::INPUT_KEY_REFERENCE_VIDEOS] : [],
                '视频',
            ),
            $this->buildReferenceMentionMappings(
                is_array($rawInputs[self::INPUT_KEY_REFERENCE_AUDIOS] ?? null) ? $rawInputs[self::INPUT_KEY_REFERENCE_AUDIOS] : [],
                '音频',
            ),
        );
        if ($referenceMappings === []) {
            return $prompt;
        }

        $rewrittenPrompt = $prompt;
        $replacements = [];
        foreach ($referenceMappings as $mapping) {
            $replacements[$mapping['mention']] = $mapping['placeholder'];
        }

        uksort($replacements, static fn (string $left, string $right): int => strlen($right) <=> strlen($left));
        if ($rewrittenPrompt !== '' && str_contains($rewrittenPrompt, '@')) {
            $rewrittenPrompt = str_replace(array_keys($replacements), array_values($replacements), $rewrittenPrompt);
        }

        $indexLines = array_map(
            static fn (array $mapping): string => '- ' . ltrim($mapping['placeholder'], '@') . '：' . $mapping['file_name'],
            $referenceMappings,
        );

        return '素材索引（右侧是用户上传的原始文件名，仅用于标识素材）：' . "\n"
            . implode("\n", $indexLines)
            . "\n\n"
            . '任务描述（请按素材编号理解下面的引用）：' . "\n"
            . $rewrittenPrompt;
    }

    /**
     * @param list<mixed> $references
     * @return list<array{mention: string, placeholder: string, file_name: string}>
     */
    private function buildReferenceMentionMappings(array $references, string $label): array
    {
        $mappings = [];
        $seenMentions = [];
        $index = 0;
        foreach ($references as $reference) {
            if (! is_array($reference)) {
                continue;
            }

            $fileName = $this->extractReferenceFileName((string) ($reference[self::FIELD_URI] ?? ''));
            if ($fileName === '') {
                continue;
            }

            $mention = '@' . $fileName;
            if (isset($seenMentions[$mention])) {
                continue;
            }

            ++$index;
            $seenMentions[$mention] = true;
            $mappings[] = [
                'mention' => $mention,
                'placeholder' => '@' . $label . $index,
                'file_name' => $fileName,
            ];
        }

        return $mappings;
    }

    private function extractReferenceFileName(string $uri): string
    {
        $candidate = $uri;
        if (preg_match('#^https?://#i', $uri) === 1) {
            $path = parse_url($uri, PHP_URL_PATH);
            $candidate = is_string($path) && $path !== '' ? $path : $uri;
        }

        return trim(basename(rawurldecode($candidate)));
    }

    private function buildImageUrl(
        string $organizationCode,
        string $fullPath,
        string $fileKey,
        string $errorKey,
    ): string {
        $url = $this->fileDomainService->getLink($organizationCode, $fullPath, StorageBucketType::SandBox)?->getUrl();
        if (! $url) {
            ExceptionBuilder::throw(
                DesignErrorCode::ThirdPartyServiceError,
                $errorKey,
                ['file_key' => $fileKey]
            );
        }

        return $url;
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
