<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Factory;

use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

final class DesignVideoInputPayloadPreparer
{
    /**
     * 规范化创建任务需要的输出目录和输入素材路径。
     */
    public static function sanitizeDtoForCreate(DesignVideoCreateDTO $dto): void
    {
        $dto->setFileDir(self::normalizePath($dto->getFileDir(), true, 'file_dir'));
        self::applyPreparedInputs($dto, self::prepareInputs($dto));
    }

    /**
     * 将视频输入素材整理为统一 payload，并拒绝空路径、外部 URL 和目录穿越路径。
     *
     * @return array<string, mixed>
     */
    public static function prepareInputs(DesignVideoCreateDTO $dto): array
    {
        $maskInput = $dto->getMask() === null
            ? []
            : ['uri' => self::normalizePath($dto->getMask(), false, 'mask')];

        $referenceImages = [];
        foreach ($dto->getReferenceImages() as $referenceImage) {
            $item = ['uri' => self::normalizePath((string) ($referenceImage['uri'] ?? ''), false, 'reference_images.uri')];
            $type = trim((string) ($referenceImage['type'] ?? ''));
            if ($type !== '') {
                $item['type'] = $type;
            }
            $referenceImages[] = $item;
        }

        $referenceVideos = [];
        foreach ($dto->getReferenceVideos() as $referenceVideo) {
            $referenceVideos[] = [
                'uri' => self::normalizePath((string) ($referenceVideo['uri'] ?? ''), false, 'reference_videos.uri'),
            ];
        }

        $referenceAudios = [];
        foreach ($dto->getReferenceAudios() as $referenceAudio) {
            $referenceAudios[] = [
                'uri' => self::normalizePath((string) ($referenceAudio['uri'] ?? ''), false, 'reference_audios.uri'),
            ];
        }

        $frames = [];
        foreach ($dto->getFrames() as $frame) {
            $frames[] = [
                'role' => (string) ($frame['role'] ?? ''),
                'uri' => self::normalizePath((string) ($frame['uri'] ?? ''), false, 'frames.uri'),
            ];
        }

        return array_filter([
            'mask' => $maskInput,
            'reference_images' => $referenceImages,
            'reference_videos' => $referenceVideos,
            'reference_audios' => $referenceAudios,
            'frames' => $frames,
        ], static fn (mixed $value): bool => $value !== []);
    }

    /**
     * 把规范化后的 inputs 写回 DTO，供创建任务 factory 继续构建实体。
     *
     * @param array<string, mixed> $inputs
     */
    private static function applyPreparedInputs(DesignVideoCreateDTO $dto, array $inputs): void
    {
        $dto->setMask(is_array($inputs['mask'] ?? null) ? (string) ($inputs['mask']['uri'] ?? '') : null);
        $dto->setReferenceImages(is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : []);
        $dto->setReferenceVideos(is_array($inputs['reference_videos'] ?? null) ? $inputs['reference_videos'] : []);
        $dto->setReferenceAudios(is_array($inputs['reference_audios'] ?? null) ? $inputs['reference_audios'] : []);
        $dto->setFrames(is_array($inputs['frames'] ?? null) ? $inputs['frames'] : []);
    }

    /**
     * 统一工作区路径格式；输入素材不允许使用根目录。
     */
    private static function normalizePath(string $path, bool $allowRoot, string $label): string
    {
        $path = trim($path);
        if ($path === '') {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.empty', ['label' => $label]);
        }

        if (str_contains($path, '://')) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.invalid', ['label' => $label]);
        }

        $path = '/' . trim($path, '/');
        if ($path === '/') {
            if ($allowRoot) {
                return $path;
            }
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.invalid', ['label' => $label]);
        }

        foreach (explode('/', trim($path, '/')) as $segment) {
            if ($segment === '.' || $segment === '..') {
                ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.invalid', ['label' => $label]);
            }
        }

        return $path;
    }
}
