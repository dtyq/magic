<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * 50000 - 50099 视频生成业务错误码。
 */
enum VideoGenerateErrorCode: int
{
    // 视频生成失败
    #[ErrorMessage(message: 'video_generate.general_error')]
    case GENERAL_ERROR = 50000;

    // 视频服务返回数据异常
    #[ErrorMessage(message: 'video_generate.response_format_error')]
    case RESPONSE_FORMAT_ERROR = 50001;

    // 视频服务未返回有效视频
    #[ErrorMessage(message: 'video_generate.missing_video_data')]
    case MISSING_VIDEO_DATA = 50002;

    // 输入提示词未通过内容审核
    #[ErrorMessage(message: 'video_generate.input_text_audit_failed')]
    case INPUT_TEXT_AUDIT_FAILED = 50003;

    // 输入图片未通过内容审核
    #[ErrorMessage(message: 'video_generate.input_image_audit_failed')]
    case INPUT_IMAGE_AUDIT_FAILED = 50004;

    // 输入视频未通过内容审核
    #[ErrorMessage(message: 'video_generate.input_video_audit_failed')]
    case INPUT_VIDEO_AUDIT_FAILED = 50005;

    // 输入音频未通过内容审核
    #[ErrorMessage(message: 'video_generate.input_audio_audit_failed')]
    case INPUT_AUDIO_AUDIT_FAILED = 50006;

    // 生成文本未通过内容审核
    #[ErrorMessage(message: 'video_generate.output_text_audit_failed')]
    case OUTPUT_TEXT_AUDIT_FAILED = 50007;

    // 生成视频未通过内容审核
    #[ErrorMessage(message: 'video_generate.output_video_audit_failed')]
    case OUTPUT_VIDEO_AUDIT_FAILED = 50008;

    // 生成音频未通过内容审核
    #[ErrorMessage(message: 'video_generate.output_audio_audit_failed')]
    case OUTPUT_AUDIO_AUDIT_FAILED = 50009;

    // 提示词不符合要求
    #[ErrorMessage(message: 'video_generate.invalid_prompt')]
    case INVALID_PROMPT = 50010;

    // 请求参数不合法
    #[ErrorMessage(message: 'video_generate.invalid_parameter')]
    case INVALID_PARAMETER = 50011;

    // 视频或素材格式不受支持
    #[ErrorMessage(message: 'video_generate.unsupported_video_format')]
    case UNSUPPORTED_VIDEO_FORMAT = 50012;

    // 视频比例不受支持
    #[ErrorMessage(message: 'video_generate.invalid_aspect_ratio')]
    case INVALID_ASPECT_RATIO = 50013;

    // 查询视频任务失败
    #[ErrorMessage(message: 'video_generate.polling_failed')]
    case POLLING_FAILED = 50014;

    // 视频生成超时
    #[ErrorMessage(message: 'video_generate.task_timeout')]
    case TASK_TIMEOUT = 50015;

    // 输入图片可能包含真人或人脸
    #[ErrorMessage(message: 'video_generate.input_image_privacy_failed')]
    case INPUT_IMAGE_PRIVACY_FAILED = 50021;

    // 输入图片可能涉及版权相关限制
    #[ErrorMessage(message: 'video_generate.input_image_policy_violation')]
    case INPUT_IMAGE_POLICY_VIOLATION = 50022;

    // 输入视频可能包含真人或人脸
    #[ErrorMessage(message: 'video_generate.input_video_privacy_failed')]
    case INPUT_VIDEO_PRIVACY_FAILED = 50023;

    // 输入视频可能涉及版权相关限制
    #[ErrorMessage(message: 'video_generate.input_video_policy_violation')]
    case INPUT_VIDEO_POLICY_VIOLATION = 50024;

    // 生成音频可能涉及版权相关限制
    #[ErrorMessage(message: 'video_generate.output_audio_policy_violation')]
    case OUTPUT_AUDIO_POLICY_VIOLATION = 50025;

    // 输入或生成内容可能包含敏感信息
    #[ErrorMessage(message: 'video_generate.sensitive_content_detected')]
    case SENSITIVE_CONTENT_DETECTED = 50026;

    // 输入提示词可能包含敏感信息
    #[ErrorMessage(message: 'video_generate.input_text_sensitive_content_detected')]
    case INPUT_TEXT_SENSITIVE_CONTENT_DETECTED = 50027;

    // 输入提示词可能涉及版权相关限制
    #[ErrorMessage(message: 'video_generate.input_text_sensitive_content_detected_policy_violation')]
    case INPUT_TEXT_SENSITIVE_CONTENT_DETECTED_POLICY_VIOLATION = 50028;

    // 输入图片可能包含敏感信息
    #[ErrorMessage(message: 'video_generate.input_image_sensitive_content_detected')]
    case INPUT_IMAGE_SENSITIVE_CONTENT_DETECTED = 50029;

    // 输入视频可能包含敏感信息
    #[ErrorMessage(message: 'video_generate.input_video_sensitive_content_detected')]
    case INPUT_VIDEO_SENSITIVE_CONTENT_DETECTED = 50030;

    // 输入音频可能涉及版权相关限制
    #[ErrorMessage(message: 'video_generate.input_audio_sensitive_content_detected_policy_violation')]
    case INPUT_AUDIO_SENSITIVE_CONTENT_DETECTED_POLICY_VIOLATION = 50031;

    // 生成内容可能包含敏感信息
    #[ErrorMessage(message: 'video_generate.output_text_sensitive_content_detected')]
    case OUTPUT_TEXT_SENSITIVE_CONTENT_DETECTED = 50032;

    // 生成图片可能包含敏感或受限内容
    #[ErrorMessage(message: 'video_generate.output_image_sensitive_content_detected')]
    case OUTPUT_IMAGE_SENSITIVE_CONTENT_DETECTED = 50033;

    // 生成视频可能包含敏感信息
    #[ErrorMessage(message: 'video_generate.output_video_sensitive_content_detected')]
    case OUTPUT_VIDEO_SENSITIVE_CONTENT_DETECTED = 50034;

    // 生成视频可能涉及版权相关限制
    #[ErrorMessage(message: 'video_generate.output_video_sensitive_content_detected_policy_violation')]
    case OUTPUT_VIDEO_SENSITIVE_CONTENT_DETECTED_POLICY_VIOLATION = 50035;

    // 生成音频可能包含敏感或受限内容
    #[ErrorMessage(message: 'video_generate.output_audio_sensitive_content_detected')]
    case OUTPUT_AUDIO_SENSITIVE_CONTENT_DETECTED = 50036;

    // 当前内容可能涉及版权风险
    #[ErrorMessage(message: 'video_generate.content_security_copyright_risk')]
    case CONTENT_SECURITY_COPYRIGHT_RISK = 50037;

    // 输入内容可能包含敏感信息
    #[ErrorMessage(message: 'video_generate.content_security_sensitive_content')]
    case CONTENT_SECURITY_SENSITIVE_CONTENT = 50038;

    // 素材中可能包含品牌 Logo 或商标
    #[ErrorMessage(message: 'video_generate.content_security_trademark_risk')]
    case CONTENT_SECURITY_TRADEMARK_RISK = 50039;

    // 输入内容可能包含暴力或不适画面
    case CONTENT_SECURITY_VIOLENT_CONTENT = 50040;

    // 缺少必要请求参数
    case MISSING_PARAMETER = 50041;

    // 当前视频时长不受支持
    case INVALID_PARAMETER_INVALID_VIDEO_DURATION = 50042;

    // 当前分辨率不受支持
    case INVALID_PARAMETER_INVALID_RESOLUTION = 50043;

    // 未检测到有效素材
    case INVALID_PARAMETER_EMPTY_INPUT = 50044;

    // 请求格式不合法
    case INVALID_REQUEST_ERROR = 50045;

    // 请求参数内容不合法
    case INVALID_ARGUMENT_ERROR = 50046;

    // 当前服务繁忙
    case SERVER_OVERLOADED = 50047;

    // 素材格式不受支持
    case INVALID_FILE_FORMAT = 50049;

    // 素材文件大小超出限制
    case FILE_SIZE_TOO_LARGE = 50050;

    // 音频时长长于生成视频时长
    case AUDIO_DURATION_TOO_LONG = 50051;

    public function getMessage(): string
    {
        $key = 'video_generate.' . strtolower($this->name);
        try {
            $message = trans($key);
        } catch (Throwable) {
            return $key;
        }
        if (is_array($message)) {
            return implode(' ', $message);
        }

        return is_string($message) && $message !== '' ? $message : $key;
    }
}
