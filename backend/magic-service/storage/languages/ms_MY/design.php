<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'image_generation' => [
        'file_dir_invalid' => 'File directory must be in the current project workspace',
        'file_dir_not_exists' => 'File directory does not exist: :file_dir',
        'reference_image_not_exists' => 'Reference image does not exist: :file_key',
        'image_id_exists' => 'Image ID already exists: :image_id',
        'generate_image_failed' => 'Failed to generate image',
        'generate_image_failed_with_message' => 'Failed to generate image: :message',
        'missing_image_data_error_prompt_only' => 'Image generation failed. The prompt may be unclear. Please check if the prompt description is accurate and detailed, then try again.',
        'missing_image_data_error_with_reference' => 'Image generation failed. The prompt may be unclear or the reference image may be invalid. Please check if the prompt description is accurate and the reference image is valid, then try again.',
        'project_not_exists' => 'Project does not exist: :project_id',
        'feature_unavailable' => 'Ciri ini tidak tersedia pada masa ini',
    ],
    'image_mark_identify' => [
        'project_not_exists' => 'Project does not exist: :project_id',
        'file_not_exists' => 'Image file does not exist: :file_path',
        'cannot_get_image_url' => 'Cannot get image URL: :file_path',
        'agent_disabled' => 'Image mark identifier service is temporarily unavailable',
        'identification_failed' => 'Image identification failed: :error',
    ],
    'third_party_service_error' => 'Third party service error',
    'attributes' => [
        'project_id' => 'Project ID',
        'image_id' => 'Image ID',
        'model_id' => 'Model ID',
        'prompt' => 'Prompt',
        'size' => 'Image Size',
        'file_dir' => 'File Directory',
        'file_name' => 'File Name',
        'reference_images' => 'Reference Images',
        'reference_image' => 'Reference Image',
        'file_path' => 'File Path',
        'mark' => 'Mark Position',
        'mark_coordinate' => 'Mark Coordinate',
    ],
    'validation' => [
        'reference_images_max' => 'You can upload up to 20 reference images',
        'mark_size' => 'Mark position must contain exactly 2 coordinates (x, y)',
        'mark_coordinate_range' => 'Mark coordinate must be between 0 and 1',
    ],
];
