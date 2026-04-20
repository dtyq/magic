<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\Assembler;

use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\Domain\Design\Factory\DesignGenerationTaskFactory;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationType;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Design\DTO\VideoGenerationDTO;

final class DesignVideoAssembler
{
    public static function toDO(DesignVideoCreateDTO $dto): DesignGenerationTaskEntity
    {
        self::sanitizePaths($dto);
        return DesignGenerationTaskFactory::createVideoTask($dto);
    }

    public static function toDTO(DesignGenerationTaskEntity $entity): VideoGenerationDTO
    {
        $dto = new VideoGenerationDTO();
        $dto->setProjectId($entity->getProjectId());
        $dto->setVideoId($entity->getGenerationId());
        $dto->setModelId($entity->getModelId());
        $dto->setPrompt($entity->getPrompt());
        $dto->setFileDir($entity->getFileDir());
        $dto->setFileName($entity->getFileName() !== '' ? $entity->getFileName() : null);
        $dto->setType(match ($entity->getGenerationType()) {
            DesignGenerationType::TEXT_TO_VIDEO => VideoGenerationType::TEXT_TO_VIDEO->value,
            DesignGenerationType::IMAGE_TO_VIDEO => VideoGenerationType::IMAGE_TO_VIDEO->value,
        });
        $dto->setStatus($entity->getStatus()->value);
        $dto->setErrorMessage($entity->getStatus()->value === 'failed' ? $entity->getErrorMessage() : null);
        $dto->setCreatedAt($entity->getCreatedAt());
        $dto->setUpdatedAt($entity->getUpdatedAt());
        $dto->setFileId($entity->getFileId());
        $dto->setFileUrl($entity->getFileUrl());
        $dto->setPosterFileId($entity->getPosterFileId());
        $dto->setPosterUrl($entity->getPosterUrl());

        return $dto;
    }

    private static function sanitizePaths(DesignVideoCreateDTO $dto): void
    {
        $dto->setFileDir(self::normalizePath($dto->getFileDir(), true, 'file_dir'));

        if ($dto->getMask() !== null) {
            $dto->setMask(self::normalizePath($dto->getMask(), false, 'mask'));
        }

        $normalizedReferenceImages = [];
        foreach ($dto->getReferenceImages() as $referenceImage) {
            $item = ['uri' => self::normalizePath((string) ($referenceImage['uri'] ?? ''), false, 'reference_images.uri')];
            $type = trim((string) ($referenceImage['type'] ?? ''));
            if ($type !== '') {
                $item['type'] = $type;
            }
            $normalizedReferenceImages[] = $item;
        }
        $dto->setReferenceImages($normalizedReferenceImages);

        $normalizedFrames = [];
        foreach ($dto->getFrames() as $frame) {
            $normalizedFrames[] = [
                'role' => (string) ($frame['role'] ?? ''),
                'uri' => self::normalizePath((string) ($frame['uri'] ?? ''), false, 'frames.uri'),
            ];
        }
        $dto->setFrames($normalizedFrames);

        $normalizedReferenceVideos = [];
        foreach ($dto->getReferenceVideos() as $referenceVideo) {
            $normalizedReferenceVideos[] = [
                'uri' => self::normalizePath((string) ($referenceVideo['uri'] ?? ''), false, 'reference_videos.uri'),
            ];
        }
        $dto->setReferenceVideos($normalizedReferenceVideos);

        $normalizedReferenceAudios = [];
        foreach ($dto->getReferenceAudios() as $referenceAudio) {
            $normalizedReferenceAudios[] = [
                'uri' => self::normalizePath((string) ($referenceAudio['uri'] ?? ''), false, 'reference_audios.uri'),
            ];
        }
        $dto->setReferenceAudios($normalizedReferenceAudios);
    }

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
