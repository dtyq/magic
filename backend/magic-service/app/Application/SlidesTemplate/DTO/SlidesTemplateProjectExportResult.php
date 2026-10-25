<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SlidesTemplate\DTO;

use App\ErrorCode\SlidesTemplateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

final class SlidesTemplateProjectExportResult
{
    public function __construct(
        private readonly string $code,
        private readonly ?string $categoryCode,
        private readonly array $label,
        private readonly array $description,
        private readonly string $thumbnailFileKey,
        private readonly ?string $collageFileKey,
        private readonly array $previewImageFileKeys,
        private readonly string $templateFileKey,
        private readonly array $tagCodes,
        private readonly int $projectId,
        private readonly int $projectDirectoryId,
    ) {
    }

    /** @param array<string, mixed> $metadata */
    public static function fromSandbox(
        string $code,
        string $fileKey,
        array $metadata,
        int $projectId,
        int $directoryId,
    ): self {
        $templateFileKey = trim((string) ($metadata['template_file_key'] ?? $fileKey));
        if ($templateFileKey === '') {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::PROJECT_TEMPLATE_MANIFEST_INVALID);
        }

        return new self(
            $code,
            self::nullableString($metadata['category_code'] ?? null),
            self::requiredI18n($metadata['label'] ?? null, 'label'),
            self::requiredI18n($metadata['description'] ?? null, 'description'),
            self::requiredString($metadata['thumbnail_file_key'] ?? null, 'thumbnail_file_key'),
            self::nullableString($metadata['collage_file_key'] ?? null),
            self::stringList($metadata['preview_image_file_keys'] ?? []),
            $templateFileKey,
            self::stringList($metadata['tag_codes'] ?? []),
            $projectId,
            $directoryId,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'code' => $this->code,
            'category_code' => $this->categoryCode,
            'label' => $this->label,
            'description' => $this->description,
            'thumbnail_file_key' => $this->thumbnailFileKey,
            'collage_file_key' => $this->collageFileKey,
            'preview_image_file_keys' => $this->previewImageFileKeys,
            'template_file_key' => $this->templateFileKey,
            'tag_codes' => $this->tagCodes,
            'project_id' => $this->projectId,
            'project_directory_id' => $this->projectDirectoryId,
        ];
    }

    private static function nullableString(mixed $value): ?string
    {
        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }

    private static function requiredString(mixed $value, string $field): string
    {
        $value = trim((string) $value);
        if ($value === '') {
            ExceptionBuilder::throw(
                SlidesTemplateErrorCode::PROJECT_TEMPLATE_MANIFEST_INVALID,
                replace: ['field' => $field],
            );
        }
        return $value;
    }

    /** @return array<string, string> */
    private static function requiredI18n(mixed $value, string $field): array
    {
        if (! is_array($value)) {
            ExceptionBuilder::throw(
                SlidesTemplateErrorCode::PROJECT_TEMPLATE_MANIFEST_INVALID,
                replace: ['field' => $field],
            );
        }
        $result = [
            'zh_CN' => trim((string) ($value['zh_CN'] ?? '')),
            'en_US' => trim((string) ($value['en_US'] ?? '')),
        ];
        if ($result['zh_CN'] === '' || $result['en_US'] === '') {
            ExceptionBuilder::throw(
                SlidesTemplateErrorCode::PROJECT_TEMPLATE_MANIFEST_INVALID,
                replace: ['field' => $field],
            );
        }
        return $result;
    }

    /** @return array<int, string> */
    private static function stringList(mixed $value): array
    {
        if (! is_array($value)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::PROJECT_TEMPLATE_MANIFEST_INVALID);
        }
        return array_values(array_filter(array_map(
            static fn (mixed $item): string => trim((string) $item),
            $value
        ), static fn (string $item): bool => $item !== ''));
    }
}
