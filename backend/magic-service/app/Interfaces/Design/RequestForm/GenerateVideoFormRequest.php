<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\RequestForm;

use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use Hyperf\Validation\Request\FormRequest;
use Hyperf\Validation\Rule;

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

    private const int MAX_BASE64_LENGTH = 24 * 1024 * 1024;

    private const int MAX_SHORT_TEXT_LENGTH = 20;

    private const int MAX_OPTION_TEXT_LENGTH = 50;

    private const int MAX_VIDEO_COUNT = 10;

    private const int MAX_AUDIO_COUNT = 10;

    private const int MAX_REFERENCE_IMAGE_COUNT = 20;

    private const int MAX_FRAME_COUNT = 2;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $taskValues = implode(',', DesignVideoCreateDTO::supportedTasks());
        $referenceImageTypes = implode(',', DesignVideoCreateDTO::REFERENCE_IMAGE_TYPES);
        $serviceTiers = implode(',', DesignVideoCreateDTO::SERVICE_TIERS);
        $frameRoles = implode(',', DesignVideoCreateDTO::FRAME_ROLES);
        $inputModes = implode(',', DesignVideoCreateDTO::inputModes());

        return [
            'project_id' => 'required|integer|min:' . self::MAX_PROJECT_ID,
            'video_id' => 'required|string|max:' . self::MAX_VIDEO_ID_LENGTH,
            'generation_type' => 'nullable|string|in:' . implode(',', array_map(
                static fn (DesignGenerationType $type): string => $type->value,
                DesignGenerationType::cases()
            )),
            'model_id' => 'required_unless:generation_type,' . DesignGenerationType::CANVAS_COMPOSITION->value . '|string|max:' . self::MAX_MODEL_ID_LENGTH,
            'topic_id' => 'nullable|string|max:' . self::MAX_CONTEXT_ID_LENGTH,
            'task_id' => 'nullable|string|max:' . self::MAX_CONTEXT_ID_LENGTH,
            'task' => 'nullable|string|in:' . $taskValues . '|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'input_mode' => 'nullable|string|in:' . $inputModes . '|max:' . self::MAX_OPTION_TEXT_LENGTH,
            // 画布合成与样片成片都不需要提示词：前者由合成参数驱动，后者从样片任务继承。
            'prompt' => [
                'string',
                'max:' . self::MAX_PROMPT_LENGTH,
                Rule::requiredIf(fn (): bool => $this->input('generation_type') !== DesignGenerationType::CANVAS_COMPOSITION->value
                    && $this->input('input_mode') !== VideoInputMode::DraftTask->value),
            ],
            'file_dir' => 'required_unless:generation_type,' . DesignGenerationType::CANVAS_COMPOSITION->value . '|string|max:' . self::MAX_FILE_DIR_LENGTH,
            'file_name' => 'nullable|string|max:' . self::MAX_FILE_NAME_LENGTH,
            'inputs' => 'nullable|array',
            'inputs.frames' => 'nullable|array|max:' . self::MAX_FRAME_COUNT,
            'inputs.frames.*' => 'required|array',
            'inputs.frames.*.role' => 'required|string|in:' . $frameRoles,
            'inputs.frames.*.uri' => 'nullable|string|max:' . self::MAX_URI_LENGTH,
            'inputs.frames.*.source_type' => 'nullable|string|in:workspace_path,base64|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'inputs.frames.*.base64_data' => 'nullable|string|max:' . self::MAX_BASE64_LENGTH,
            'inputs.frames.*.mime_type' => 'nullable|string|in:image/jpeg,image/jpg,image/png,image/webp|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'inputs.reference_images' => 'nullable|array|max:' . self::MAX_REFERENCE_IMAGE_COUNT,
            'inputs.reference_images.*' => 'required|array',
            'inputs.reference_images.*.uri' => 'nullable|string|max:' . self::MAX_URI_LENGTH,
            'inputs.reference_images.*.source_type' => 'nullable|string|in:workspace_path,base64|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'inputs.reference_images.*.base64_data' => 'nullable|string|max:' . self::MAX_BASE64_LENGTH,
            'inputs.reference_images.*.mime_type' => 'nullable|string|in:image/jpeg,image/jpg,image/png,image/webp|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'inputs.reference_images.*.type' => 'nullable|string|in:' . $referenceImageTypes . '|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'inputs.reference_videos' => 'nullable|array|max:' . self::MAX_VIDEO_COUNT,
            'inputs.reference_videos.*' => 'required|array',
            'inputs.reference_videos.*.uri' => 'required|string|max:' . self::MAX_URI_LENGTH,
            'inputs.reference_audios' => 'nullable|array|max:' . self::MAX_AUDIO_COUNT,
            'inputs.reference_audios.*' => 'required|array',
            'inputs.reference_audios.*.uri' => 'required|string|max:' . self::MAX_URI_LENGTH,
            'inputs.mask' => 'nullable|array',
            'inputs.mask.uri' => 'required_with:inputs.mask|string|max:' . self::MAX_URI_LENGTH,
            // 样片成片引用：uri 为工作区相对路径，video_id 为样片业务 ID，二者必须其一（在 DTO 里校验）。
            'inputs.draft_task' => 'nullable|array',
            'inputs.draft_task.uri' => 'nullable|string|max:' . self::MAX_URI_LENGTH,
            'inputs.draft_task.video_id' => 'nullable|string|max:' . self::MAX_VIDEO_ID_LENGTH,
            'composition' => 'nullable|array',
            'composition.videos' => 'nullable|array|max:' . self::MAX_VIDEO_COUNT,
            'composition.videos.*' => 'required|array',
            'composition.videos.*.path' => 'required|string|max:' . self::MAX_URI_LENGTH,
            'composition.audios' => 'nullable|array|max:1',
            'composition.audios.*' => 'required|array',
            'composition.audios.*.path' => 'required|string|max:' . self::MAX_URI_LENGTH,
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
            'generation.web_search' => 'nullable|boolean',
            'generation.draft' => 'nullable|boolean',
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
            'extensions.capability' => 'nullable|string|max:' . self::MAX_SHORT_TEXT_LENGTH,
            'extensions.project_path' => 'nullable|string|max:1000',
            'extensions.video_edit_element_id' => 'nullable|string|max:128',
            'extensions.output_file_name' => 'nullable|string|max:255',
        ];
    }
}
