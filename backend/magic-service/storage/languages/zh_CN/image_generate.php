<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'general_error' => '文生图服务异常',
    'response_format_error' => '文生图响应格式错误',
    'missing_image_data' => '生成图片数据异常',
    'no_valid_image_generated' => '未生成有效图片',
    'input_image_audit_failed' => '您发送的图片不符合相关规定及要求，无法为您生成对应的图片',
    'output_image_audit_failed' => '输出图片后审核未通过',
    'input_text_audit_failed' => '您发送的文本不符合相关规定及要求，无法为您生成对应的图片',
    'output_text_audit_failed' => '输出文本后审核未通过',
    'text_blocked' => '输入文本包含敏感内容，已被拦截',
    'invalid_prompt' => 'Prompt 内容不合法',
    'prompt_check_failed' => 'Prompt 校验失败',
    'polling_failed' => '轮询任务结果失败',
    'task_timeout' => '任务执行超时',
    'invalid_request_type' => '无效的请求类型',
    'missing_job_id' => '缺少任务ID',
    'task_failed' => '任务执行失败',
    'polling_response_format_error' => '轮询响应格式错误',
    'missing_image_url' => '未获取到图片URL',
    'prompt_check_response_error' => 'Prompt 校验响应格式错误',
    'api_request_failed' => '调用图片生成接口失败',
    'image_to_image_missing_source' => '图生图缺少资源: 图片 或者 base64',
    'output_image_audit_failed_with_reason' => '无法生成图片，请尝试更换提示词',
    'task_timeout_with_reason' => '文生图任务未找到或已过期',
    'not_found_error_code' => '未知错误码',
    'unsupported_image_format' => '仅支持 JPG、JPEG、BMP、PNG 格式的图片',
    'invalid_aspect_ratio' => '图生图的尺寸比例差距过大，只能相差3倍',
    'image_url_is_empty' => '图片为空',
    'unsupported_image_size' => '不支持的图片尺寸 :size，支持的尺寸为：:supported_sizes',
    'unsupported_image_size_range' => '图片尺寸 :size 超出支持范围，宽度和高度必须在 :min_size-:max_size 像素之间',

    // Azure OpenAI 相关错误消息
    'api_key_update_failed' => '更新API密钥失败',
    'prompt_required' => '图像生成提示词不能为空',
    'reference_images_required' => '图像编辑需要提供参考图像',
    'invalid_image_count' => '图像生成数量必须在1-10之间',
    'invalid_image_url' => '参考图像URL格式无效',
    'invalid_mask_url' => '遮罩图像URL格式无效',
    'no_image_generated' => '未生成任何图像',
    'invalid_image_data' => '所有图像数据无效',
    'no_valid_image_data' => '无有效图像数据',
    'response_build_failed' => '构建响应失败',
    'api_call_failed' => 'API调用失败',
    'request_conversion_failed' => '请求格式转换失败',
    'invalid_size_format' => '无效的尺寸格式，应为WIDTHxHEIGHT格式',
    'invalid_quality_parameter' => '无效的质量参数，有效选项为: standard, hd',

    'model_not_support_edit' => '模型不支持图像编辑',
];
