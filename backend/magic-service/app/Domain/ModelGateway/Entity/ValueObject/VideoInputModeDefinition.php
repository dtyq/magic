<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

/**
 * 单个视频输入模式的共享配置模板。
 */
final readonly class VideoInputModeDefinition
{
    /**
     * @param list<string> $supportedFields
     * @param array<string, mixed> $extra
     */
    private function __construct(
        private string $description,
        private array $supportedFields,
        private string $task,
        private array $extra = [],
    ) {
    }

    public static function standard(string $description, string $task = VideoTaskType::Generate->value): self
    {
        return new self(
            description: $description,
            supportedFields: [],
            task: $task,
        );
    }

    /**
     * @param list<string> $referenceTypes
     */
    public static function imageReference(
        string $description,
        int $maxCount,
        array $referenceTypes,
        bool $styleSupported,
        string $task = VideoTaskType::Generate->value,
    ): self {
        return new self(
            description: $description,
            supportedFields: ['reference_images'],
            task: $task,
            extra: [
                'reference_images' => [
                    'max_count' => $maxCount,
                    'reference_types' => array_values($referenceTypes),
                    'style_supported' => $styleSupported,
                ],
            ],
        );
    }

    /**
     * @param list<string> $supportedFields
     * @param list<array{
     *     code: string,
     *     description: string,
     *     limits: array<string, array{min?: int, max?: int}>
     * }> $variants
     */
    public static function omniReference(
        string $description,
        array $supportedFields,
        int $maxCount,
        array $variants = [],
        string $task = VideoTaskType::Generate->value,
    ): self {
        $extra = ['max_count' => $maxCount];
        if ($variants !== []) {
            $extra['variants'] = array_values($variants);
        }

        return new self(
            description: $description,
            supportedFields: array_values($supportedFields),
            task: $task,
            extra: $extra,
        );
    }

    public static function videoEdit(
        string $description,
        int $maxCount = 1,
        string $task = VideoTaskType::Edit->value,
    ): self {
        return new self(
            description: $description,
            supportedFields: ['reference_videos'],
            task: $task,
            extra: ['max_count' => $maxCount],
        );
    }

    /**
     * @param list<string> $frameRoles
     */
    public static function keyframeGuided(
        string $description,
        array $frameRoles,
        string $task = VideoTaskType::Generate->value,
    ): self {
        return new self(
            description: $description,
            supportedFields: ['frames'],
            task: $task,
            extra: ['frame_roles' => array_values($frameRoles)],
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return array_merge([
            'description' => $this->description,
            'supported_fields' => $this->supportedFields,
        ], $this->extra, [
            'task' => $this->task,
        ]);
    }
}
