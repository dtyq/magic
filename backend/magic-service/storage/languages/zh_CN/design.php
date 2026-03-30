<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'image_generation' => [
        'file_dir_invalid' => '文件目录必须是当前项目工作区路径',
        'file_dir_not_exists' => '文件目录不存在: :file_dir',
        'reference_image_not_exists' => '参考图片不存在: :file_key',
        'image_id_exists' => '图片ID已存在: :image_id',
        'generate_image_failed' => '图片生成失败',
        'generate_image_failed_with_message' => '图片生成失败: :message',
        'missing_image_data_error_prompt_only' => '图片生成失败，可能是提示词不够清晰，请检查提示词描述是否准确、详细，调整后重试。',
        'missing_image_data_error_with_reference' => '图片生成失败，可能是提示词不够清晰或参考图像有问题，请检查提示词描述是否准确，参考图像是否有效，调整后重试。',
        'project_not_exists' => '项目不存在: :project_id',
    ],
    'image_mark_identify' => [
        'project_not_exists' => '项目不存在: :project_id',
        'file_not_exists' => '图片文件不存在: :file_path',
        'cannot_get_image_url' => '无法获取图片URL: :file_path',
        'agent_disabled' => '图片标记识别服务暂时不可用',
        'identification_failed' => '图片识别失败: :error',
    ],
    'third_party_service_error' => '第三方服务错误',
    'attributes' => [
        'project_id' => '项目ID',
        'image_id' => '图片ID',
        'model_id' => '模型ID',
        'prompt' => '提示词',
        'size' => '图片尺寸',
        'file_dir' => '文件目录',
        'file_name' => '文件名',
        'reference_images' => '参考图片',
        'reference_image' => '参考图片',
        'file_path' => '文件路径',
        'mark' => '标记位置',
        'mark_coordinate' => '标记坐标',
    ],
    'validation' => [
        'reference_images_max' => '参考图片最多只能上传20张',
        'mark_size' => '标记位置必须包含恰好2个坐标 (x, y)',
        'mark_coordinate_range' => '标记坐标必须在0到1之间',
    ],
];
