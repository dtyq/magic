<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\RequestForm;

use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use Hyperf\Validation\Request\FormRequest;

class GenerateVideoFormRequest extends FormRequest
{
    private const int MAX_PROJECT_ID = 1;

    private const int MAX_VIDEO_ID_LENGTH = 80;

    private const int MAX_MODEL_ID_LENGTH = 80;

    private const int MAX_CONTEXT_ID_LENGTH = 128;

    private const int MAX_PROMPT_LENGTH = 4096;

    private const int MAX_FILE_DIR_LENGTH = 512;

    private const int MAX_FILE_NAME_LENGTH = 255;

    private const int MAX_URI_LENGTH = 4096;

    private const int MAX_SHORT_TEXT_LENGTH = 20;

    private const int MAX_OPTION_TEXT_LENGTH = 50;

    private const int MAX_AUDIO_COUNT = 10;

    private const int MAX_REFERENCE_IMAGE_COUNT = 20;

    private const int MAX_FRAME_COUNT = 2;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $taskValues = implode(',', DesignVideoCreateDTO::SUPPORTED_TASKS);
        $referenceImageTypes = implode(',', DesignVideoCreateDTO::REFERENCE_IMAGE_TYPES);
        $serviceTiers = implode(',', DesignVideoCreateDTO::SERVICE_TIERS);
        $frameRoles = implode(',', DesignVideoCreateDTO::FRAME_ROLES);
        $audioRoles = implode(',', DesignVideoCreateDTO::AUDIO_ROLES);

        return [
            'project_id' => 'required|integer|min:' . self::MAX_PROJECT_ID,
            'video_id' => 'required|string|max:' . self::MAX_VIDEO_ID_LENGTH,
            'model_id' => 'required|string|max:' . self::MAX_MODEL_ID_LENGTH,
            'topic_id' => 'nullable|string|max:' . self::MAX_CONTEXT_ID_LENGTH,
            'task_id' => 'nullable|string|max:' . self::MAX_CONTEXT_ID_LENGTH,
            'task' => 'nullable|string|in:' . $taskValues . '|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'prompt' => 'required|string|max:' . self::MAX_PROMPT_LENGTH,
            'file_dir' => 'required|string|max:' . self::MAX_FILE_DIR_LENGTH,
            'file_name' => 'nullable|string|max:' . self::MAX_FILE_NAME_LENGTH,
            'inputs' => 'nullable|array',
            'inputs.frames' => 'nullable|array|max:' . self::MAX_FRAME_COUNT,
            'inputs.frames.*' => 'required|array',
            'inputs.frames.*.role' => 'required|string|in:' . $frameRoles,
            'inputs.frames.*.uri' => 'required|string|max:' . self::MAX_URI_LENGTH,
            'inputs.reference_images' => 'nullable|array|max:' . self::MAX_REFERENCE_IMAGE_COUNT,
            'inputs.reference_images.*' => 'required|array',
            'inputs.reference_images.*.uri' => 'required|string|max:' . self::MAX_URI_LENGTH,
            'inputs.reference_images.*.type' => 'nullable|string|in:' . $referenceImageTypes . '|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'inputs.video' => 'nullable|array',
            'inputs.video.uri' => 'required_with:inputs.video|string|max:' . self::MAX_URI_LENGTH,
            'inputs.mask' => 'nullable|array',
            'inputs.mask.uri' => 'required_with:inputs.mask|string|max:' . self::MAX_URI_LENGTH,
            'inputs.audio' => 'nullable|array|max:' . self::MAX_AUDIO_COUNT,
            'inputs.audio.*' => 'required|array',
            'inputs.audio.*.role' => 'required|string|in:' . $audioRoles,
            'inputs.audio.*.uri' => 'required|string|max:' . self::MAX_URI_LENGTH,
            'generation' => 'nullable|array',
            'generation.size' => 'nullable|string|max:' . self::MAX_OPTION_TEXT_LENGTH,
            'generation.mode' => 'nullable|string|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'generation.aspect_ratio' => 'nullable|string|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'generation.duration_seconds' => 'nullable|integer|min:1',
            'generation.resolution' => 'nullable|string|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'generation.fps' => 'nullable|integer|min:1',
            'generation.seed' => 'nullable|integer',
            'generation.sample_count' => 'nullable|integer|min:1',
            'generation.watermark' => 'nullable|boolean',
            'generation.negative_prompt' => 'nullable|string|max:' . self::MAX_PROMPT_LENGTH,
            'generation.generate_audio' => 'nullable|boolean',
            'generation.person_generation' => 'nullable|string|max:' . self::MAX_OPTION_TEXT_LENGTH,
            'generation.enhance_prompt' => 'nullable|boolean',
            'generation.compression_quality' => 'nullable|string|max:' . self::MAX_OPTION_TEXT_LENGTH,
            'generation.resize_mode' => 'nullable|string|max:' . self::MAX_OPTION_TEXT_LENGTH,
            'generation.camera_fixed' => 'nullable|boolean',
            'generation.return_last_frame' => 'nullable|boolean',
            'callbacks' => 'nullable|array',
            'callbacks.webhook_url' => 'nullable|string|max:' . self::MAX_URI_LENGTH,
            'execution' => 'nullable|array',
            'execution.service_tier' => 'nullable|string|in:' . $serviceTiers . '|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'execution.expires_after_seconds' => 'nullable|integer|min:1',
            'extensions' => 'nullable|array',
        ];
    }
}
