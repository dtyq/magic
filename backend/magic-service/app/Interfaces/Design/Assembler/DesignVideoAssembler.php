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
use App\Domain\Design\Factory\DesignVideoInputPayloadPreparer;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationType;
use App\Interfaces\Design\DTO\VideoGenerationDTO;
use DateTime;
use Throwable;

final class DesignVideoAssembler
{
    public static function toDO(DesignVideoCreateDTO $dto): DesignGenerationTaskEntity
    {
        if ($dto->getGenerationType() === DesignGenerationType::CANVAS_COMPOSITION->value) {
            DesignVideoInputPayloadPreparer::sanitizeCanvasCompositionDto($dto);
            $dto->validForCanvasComposition();
        } else {
            DesignVideoInputPayloadPreparer::sanitizeDtoForCreate($dto);
        }
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
            DesignGenerationType::CANVAS_COMPOSITION => null,
        });
        $dto->setStatus($entity->getStatus()->value);
        $dto->setErrorMessage($entity->getStatus()->value === 'failed' ? $entity->getErrorMessage() : null);
        $dto->setCreatedAt($entity->getCreatedAt());
        $dto->setUpdatedAt($entity->getUpdatedAt());
        $dto->setFileId($entity->getFileId());
        $dto->setFileUrl($entity->getFileUrl());
        $dto->setPosterFileId($entity->getPosterFileId());
        $dto->setPosterUrl($entity->getPosterUrl());
        $dto->setBilling([
            'points' => null,
        ]);
        $dto->setGenerationInfo(self::buildGenerationInfo($entity));
        $dto->setRuntime(self::buildRuntime($entity));

        return $dto;
    }

    /**
     * @return array<string, null|int|string>
     */
    private static function buildGenerationInfo(DesignGenerationTaskEntity $entity): array
    {
        $requestPayload = $entity->getRequestPayload();
        $generation = self::arrayValue($requestPayload['generation'] ?? null);
        $outputPayload = $entity->getOutputPayload();

        $isCanvasComposition = $entity->getGenerationType() === DesignGenerationType::CANVAS_COMPOSITION;

        return [
            'generation_type' => $entity->getGenerationType()->value,
            'task' => self::stringValue($requestPayload['task'] ?? null),
            'input_mode' => self::stringValue($requestPayload['input_mode'] ?? null),
            'aspect_ratio' => self::stringValue($generation['aspect_ratio'] ?? null),
            'resolution' => self::stringValue($generation['resolution'] ?? null)
                ?? self::stringValue($outputPayload['resolution'] ?? null),
            'duration_seconds' => $isCanvasComposition
                ? self::intValue($outputPayload['duration_seconds'] ?? null)
                : self::intValue($generation['duration_seconds'] ?? null)
                    ?? self::intValue($outputPayload['duration_seconds'] ?? null),
        ];
    }

    /**
     * @return array{started_at: ?string, finished_at: ?string, elapsed_seconds: ?int}
     */
    private static function buildRuntime(DesignGenerationTaskEntity $entity): array
    {
        $providerPayload = $entity->getProviderPayload();
        $startedAt = self::dateTimeValue($providerPayload['submitted_at'] ?? null);
        $finishedAt = $entity->getStatus()->isFinal() ? $entity->getUpdatedAt() : null;

        return [
            'started_at' => self::formatDateTime($startedAt),
            'finished_at' => self::formatDateTime($finishedAt),
            'elapsed_seconds' => self::calculateElapsedSeconds($startedAt, $finishedAt),
        ];
    }

    private static function arrayValue(mixed $value): array
    {
        return is_array($value) ? $value : [];
    }

    private static function stringValue(mixed $value): ?string
    {
        if (! is_string($value) && ! is_int($value)) {
            return null;
        }

        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }

    private static function intValue(mixed $value): ?int
    {
        if (! is_int($value) && ! is_numeric($value)) {
            return null;
        }

        $value = (int) $value;
        return $value > 0 ? $value : null;
    }

    private static function dateTimeValue(mixed $value): ?DateTime
    {
        if ($value instanceof DateTime) {
            return $value;
        }
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return new DateTime($value);
        } catch (Throwable) {
            return null;
        }
    }

    private static function formatDateTime(?DateTime $dateTime): ?string
    {
        return $dateTime?->format('Y-m-d H:i:s');
    }

    private static function calculateElapsedSeconds(?DateTime $startedAt, ?DateTime $finishedAt): ?int
    {
        if ($startedAt === null) {
            return null;
        }

        $endAt = $finishedAt ?? new DateTime();
        return max(0, $endAt->getTimestamp() - $startedAt->getTimestamp());
    }
}
