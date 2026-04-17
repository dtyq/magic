<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Factory;

use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Entity\ValueObject\DesignGenerationAssetType;
use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\Domain\Design\Repository\Persistence\Model\DesignGenerationTaskModel;

class DesignGenerationTaskFactory
{
    public static function createVideoTask(DesignVideoCreateDTO $requestDTO): DesignGenerationTaskEntity
    {
        $entity = new DesignGenerationTaskEntity();
        $entity->setProjectId($requestDTO->getProjectId());
        $entity->setGenerationId($requestDTO->getVideoId());
        $entity->setAssetType(DesignGenerationAssetType::VIDEO);
        $inputMode = $requestDTO->getInputMode();
        $entity->setGenerationType(
            ($requestDTO->getReferenceImages() !== []
                || $requestDTO->getReferenceVideos() !== []
                || $requestDTO->getReferenceAudios() !== []
                || $requestDTO->getFrames() !== []
                || $requestDTO->getMask() !== null)
                ? DesignGenerationType::IMAGE_TO_VIDEO
                : DesignGenerationType::TEXT_TO_VIDEO
        );
        $entity->setModelId($requestDTO->getModelId());
        $entity->setPrompt($requestDTO->getPrompt());
        $entity->setFileDir($requestDTO->getFileDir());
        $entity->setFileName($requestDTO->getFileName() ?? '');

        $maskInput = $requestDTO->getMask() === null ? [] : ['uri' => $requestDTO->getMask()];
        $referenceImages = $requestDTO->getReferenceImages();
        $frames = $requestDTO->getFrames();
        $referenceVideos = $requestDTO->getReferenceVideos();
        $referenceAudios = $requestDTO->getReferenceAudios();

        // input_payload 仅保留当前协议字段，方便工作区文件校验和提单链路统一消费。
        $entity->setInputPayload(array_filter([
            'mask' => $maskInput,
            'reference_images' => $referenceImages,
            'reference_videos' => $referenceVideos,
            'reference_audios' => $referenceAudios,
            'frames' => $frames,
        ], static fn (mixed $value): bool => $value !== []));

        // request_payload 顶层透传 input_mode，避免在 app / gateway 层丢失输入模式语义。
        $requestPayload = [
            'video_id' => $requestDTO->getVideoId(),
            'input_mode' => $inputMode,
            'prompt' => $requestDTO->getPrompt(),
            'model_id' => $requestDTO->getModelId(),
            'task' => $requestDTO->getTask(),
            'inputs' => array_filter([
                'mask' => $maskInput,
                'reference_images' => $referenceImages,
                'reference_videos' => $referenceVideos,
                'reference_audios' => $referenceAudios,
                'frames' => $frames,
            ], static fn (mixed $value): bool => $value !== []),
            'generation' => $requestDTO->getGeneration(),
            'callbacks' => $requestDTO->getCallbacks(),
            'execution' => $requestDTO->getExecution(),
            'extensions' => $requestDTO->getExtensions(),
        ];
        if ($requestDTO->getTopicId() !== '') {
            $requestPayload['topic_id'] = $requestDTO->getTopicId();
        }
        if ($requestDTO->getTaskId() !== '') {
            $requestPayload['task_id'] = $requestDTO->getTaskId();
        }
        $entity->setRequestPayload($requestPayload);

        $entity->setProviderPayload([
            'provider' => '',
            'submit_endpoint' => '',
            'operation_id' => '',
            'provider_task_id' => '',
            'submitted_at' => null,
            'poll_attempts' => 0,
            'deadline_at' => null,
            'last_polled_at' => null,
            'last_provider_status' => '',
            'last_provider_code' => '',
            'last_provider_message' => '',
            'last_provider_result' => [],
            'last_provider_result_updated_at' => null,
            'first_poll_status' => 'pending',
            'first_poll_attempts' => 0,
            'first_poll_last_error' => '',
            'first_poll_enqueued_at' => null,
            'first_poll_next_retry_at' => null,
        ]);

        $entity->setOutputPayload([
            'relative_file_path' => '',
            'relative_poster_path' => '',
            'poster_file_name' => '',
            'provider_video_url' => '',
            'provider_poster_url' => '',
            'duration_seconds' => null,
            'resolution' => '',
            'fps' => null,
            'last_operation_output' => [],
            'last_output_updated_at' => null,
        ]);

        return $entity;
    }

    public static function modelToEntity(DesignGenerationTaskModel $model): DesignGenerationTaskEntity
    {
        $entity = new DesignGenerationTaskEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setUserId($model->user_id);
        $entity->setProjectId($model->project_id);
        $entity->setGenerationId($model->generation_id);
        $entity->setAssetType($model->asset_type);
        $entity->setGenerationType($model->generation_type);
        $entity->setModelId($model->model_id);
        $entity->setPrompt($model->prompt);
        $entity->setFileDir($model->file_dir);
        $entity->setFileName($model->file_name);
        $entity->setInputPayload($model->input_payload ?? []);
        $entity->setRequestPayload($model->request_payload ?? []);
        $entity->setProviderPayload($model->provider_payload ?? []);
        $entity->setOutputPayload($model->output_payload ?? []);
        $entity->setStatus($model->status);
        $entity->setErrorMessage($model->error_message);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }
}
