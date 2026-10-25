<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\ErrorCode\VideoGenerateErrorCode;
use GuzzleHttp\Exception\RequestException;
use Throwable;

use function Hyperf\Translation\trans;

final class ProviderVideoErrorMapper
{
    public static function resolveGemini(
        ?RequestException $exception = null,
        null|array|string $body = null,
    ): VideoGenerateErrorCode {
        $body = is_array($body) ? json_encode($body, JSON_THROW_ON_ERROR) : $body;
        $body ??= $exception === null ? null : self::readResponseBody($exception);
        $payload = self::decodeResponseBody($body);
        $error = is_array($payload['error'] ?? null) ? $payload['error'] : [];
        $providerCode = $error['code'] ?? $payload['code'] ?? null;
        $providerMessage = $error['message'] ?? $payload['message'] ?? $body ?? $exception?->getMessage();
        $code = self::normalize((string) $providerCode);
        $text = self::normalize((string) $providerMessage);

        // 宽高比不匹配
        if ($code === 'invalidargument' && str_contains($text, 'aspectratio')) {
            return VideoGenerateErrorCode::INVALID_ASPECT_RATIO;
        }
        // 通用参数错误
        if ($code === 'invalidargument') {
            return VideoGenerateErrorCode::INVALID_PARAMETER;
        }
        // 输入文本审核失败
        if ($code === 'inputtextsensitivecontentdetected' || $code === 'contentblocked') {
            return VideoGenerateErrorCode::INPUT_TEXT_AUDIT_FAILED;
        }
        // Gemini 请求参数错误
        if ($code === 'invalidrequest') {
            return VideoGenerateErrorCode::INVALID_PARAMETER;
        }
        // 输出视频审核失败
        if (str_contains($code, 'videowasfilteredout') || str_contains($text, 'videowasfilteredout')) {
            return VideoGenerateErrorCode::OUTPUT_VIDEO_AUDIT_FAILED;
        }

        return VideoGenerateErrorCode::GENERAL_ERROR;
    }

    /**
     * @return array{errorCode: VideoGenerateErrorCode, message: string}
     */
    public static function resolveVolcengine(
        ?RequestException $exception = null,
        null|array|string $body = null,
    ): array {
        $body = is_array($body) ? json_encode($body, JSON_THROW_ON_ERROR) : $body;
        $body ??= $exception === null ? null : self::readResponseBody($exception);
        $payload = self::decodeResponseBody($body);
        $error = is_array($payload['error'] ?? null) ? $payload['error'] : [];
        $providerCode = (string) ($error['code'] ?? $payload['code'] ?? '');
        $code = self::normalize($providerCode);

        $errorCode = match ($providerCode) {
            'SensitiveContentDetected' => VideoGenerateErrorCode::SENSITIVE_CONTENT_DETECTED,
            'InputTextSensitiveContentDetected' => VideoGenerateErrorCode::INPUT_TEXT_SENSITIVE_CONTENT_DETECTED,
            'InputTextSensitiveContentDetected.PolicyViolation' => VideoGenerateErrorCode::INPUT_TEXT_SENSITIVE_CONTENT_DETECTED_POLICY_VIOLATION,
            'InputImageSensitiveContentDetected' => VideoGenerateErrorCode::INPUT_IMAGE_SENSITIVE_CONTENT_DETECTED,
            'InputImageSensitiveContentDetected.PrivacyInformation' => VideoGenerateErrorCode::INPUT_IMAGE_PRIVACY_FAILED,
            'InputImageSensitiveContentDetected.PolicyViolation' => VideoGenerateErrorCode::INPUT_IMAGE_POLICY_VIOLATION,
            'InputVideoSensitiveContentDetected' => VideoGenerateErrorCode::INPUT_VIDEO_SENSITIVE_CONTENT_DETECTED,
            'InputVideoSensitiveContentDetected.PrivacyInformation' => VideoGenerateErrorCode::INPUT_VIDEO_PRIVACY_FAILED,
            'InputVideoSensitiveContentDetected.PolicyViolation' => VideoGenerateErrorCode::INPUT_VIDEO_POLICY_VIOLATION,
            'InputAudioSensitiveContentDetected.PolicyViolation' => VideoGenerateErrorCode::INPUT_AUDIO_SENSITIVE_CONTENT_DETECTED_POLICY_VIOLATION,
            'OutputTextSensitiveContentDetected' => VideoGenerateErrorCode::OUTPUT_TEXT_SENSITIVE_CONTENT_DETECTED,
            'OutputImageSensitiveContentDetected' => VideoGenerateErrorCode::OUTPUT_IMAGE_SENSITIVE_CONTENT_DETECTED,
            'OutputVideoSensitiveContentDetected' => VideoGenerateErrorCode::OUTPUT_VIDEO_SENSITIVE_CONTENT_DETECTED,
            'OutputVideoSensitiveContentDetected.PolicyViolation' => VideoGenerateErrorCode::OUTPUT_VIDEO_SENSITIVE_CONTENT_DETECTED_POLICY_VIOLATION,
            'OutputAudioSensitiveContentDetected' => VideoGenerateErrorCode::OUTPUT_AUDIO_SENSITIVE_CONTENT_DETECTED,
            'OutputAudioSensitiveContentDetected.PolicyViolation' => VideoGenerateErrorCode::OUTPUT_AUDIO_POLICY_VIOLATION,
            'ContentSecurity.CopyrightRisk' => VideoGenerateErrorCode::CONTENT_SECURITY_COPYRIGHT_RISK,
            'ContentSecurity.SensitiveContent' => VideoGenerateErrorCode::CONTENT_SECURITY_SENSITIVE_CONTENT,
            'ContentSecurity.TrademarkRisk' => VideoGenerateErrorCode::CONTENT_SECURITY_TRADEMARK_RISK,
            'ContentSecurity.ViolentContent' => VideoGenerateErrorCode::CONTENT_SECURITY_VIOLENT_CONTENT,
            'MissingParameter' => VideoGenerateErrorCode::MISSING_PARAMETER,
            'InvalidParameter' => VideoGenerateErrorCode::INVALID_PARAMETER,
            'InvalidParameter.InvalidVideoDuration' => VideoGenerateErrorCode::INVALID_PARAMETER_INVALID_VIDEO_DURATION,
            'InvalidParameter.InvalidResolution' => VideoGenerateErrorCode::INVALID_PARAMETER_INVALID_RESOLUTION,
            'InvalidParameter.EmptyInput' => VideoGenerateErrorCode::INVALID_PARAMETER_EMPTY_INPUT,
            'InvalidParameter.TaskTypeConstraint' => VideoGenerateErrorCode::INVALID_PARAMETER,
            'InvalidRequestError' => VideoGenerateErrorCode::INVALID_REQUEST_ERROR,
            'InvalidArgumentError' => VideoGenerateErrorCode::INVALID_ARGUMENT_ERROR,
            'ServerOverloaded' => VideoGenerateErrorCode::SERVER_OVERLOADED,
            'InternalServiceError' => VideoGenerateErrorCode::GENERAL_ERROR,
            'InvalidFileFormat' => VideoGenerateErrorCode::INVALID_FILE_FORMAT,
            'FileSizeTooLarge' => VideoGenerateErrorCode::FILE_SIZE_TOO_LARGE,
            'AudioDurationTooLong' => VideoGenerateErrorCode::AUDIO_DURATION_TOO_LONG,
            default => str_starts_with($providerCode, 'InputImageSensitiveContentDetected.')
                ? VideoGenerateErrorCode::INPUT_IMAGE_SENSITIVE_CONTENT_DETECTED
                : VideoGenerateErrorCode::GENERAL_ERROR,
        };

        // 结构：[错误码数值 => [报文关键字 => 提示文案]]，命中即用；关键字以 / 包裹时按正则匹配（覆盖多种措辞）。
        $text = (string) $body;
        $messages = [
            VideoGenerateErrorCode::INVALID_PARAMETER->value => [
                // 视频时长超出模型上限
                'request must be less than or equal to 15.2' => trans('video_generate.invalid_parameter_video_duration_exceeds_limit'),
                // 视频像素总数超出模型上限
                'video pixel count specified in the request must be less than or equal to' => trans('video_generate.invalid_parameter_video_pixel_count_exceeds_limit'),
                // 视频宽或高超出模型上限
                '/video (?:height|width) specified in the request must be less than or equal to/' => trans('video_generate.invalid_parameter_video_dimension_exceeds_limit'),
                // 图片宽高比超出支持范围
                'expected the aspect ratio to be between' => trans('video_generate.invalid_parameter_image_aspect_ratio_out_of_range'),
                // 图片尺寸过小
                'to be at least 300px' => trans('video_generate.invalid_parameter_image_size_too_small'),
            ],
        ];
        /** @var array<string, string> $hints 关键字 => 提示文案；以 / 包裹的关键字按正则匹配 */
        $hints = $messages[$errorCode->value] ?? [];
        $message = $errorCode->getMessage();
        foreach ($hints as $keyword => $hint) {
            $matched = str_starts_with($keyword, '/')
                ? preg_match($keyword, $text) === 1
                : str_contains($text, $keyword);
            if ($matched) {
                $message = $hint;
                break;
            }
        }

        return [
            'errorCode' => $errorCode,
            'message' => $message,
        ];
    }

    public static function resolveDashScope(
        ?RequestException $exception = null,
        null|array|string $body = null,
    ): VideoGenerateErrorCode {
        $body = is_array($body) ? json_encode($body, JSON_THROW_ON_ERROR) : $body;
        $body ??= $exception === null ? null : self::readResponseBody($exception);
        $payload = self::decodeResponseBody($body);
        $error = is_array($payload['error'] ?? null) ? $payload['error'] : [];
        $output = is_array($payload['output'] ?? null) ? $payload['output'] : [];
        $outputError = is_array($output['error'] ?? null) ? $output['error'] : [];
        $providerCode = $payload['code'] ?? $error['code'] ?? $output['code'] ?? $outputError['code'] ?? null;
        $providerMessage = $payload['message'] ?? $error['message'] ?? $output['message'] ?? $outputError['message'] ?? $output['task_status_msg'] ?? $body ?? $exception?->getMessage();
        $code = self::normalize((string) $providerCode);
        $text = self::normalize((string) $providerMessage);

        // 宽高比不匹配
        if (str_starts_with($code, 'invalidparameterinvalidaspectratio') || $code === 'invalidaspectratio') {
            return VideoGenerateErrorCode::INVALID_ASPECT_RATIO;
        }
        // 输入视频审核失败
        if (str_starts_with($code, 'inputvideosensitivecontentdetected')) {
            return VideoGenerateErrorCode::INPUT_VIDEO_AUDIT_FAILED;
        }
        // 输入图片审核失败
        if (str_starts_with($code, 'inputimagesensitivecontentdetected')) {
            return VideoGenerateErrorCode::INPUT_IMAGE_AUDIT_FAILED;
        }
        // 输入文本审核失败
        if (str_starts_with($code, 'inputtextsensitivecontentdetected')) {
            return VideoGenerateErrorCode::INPUT_TEXT_AUDIT_FAILED;
        }
        // 输入音频审核失败
        if (str_starts_with($code, 'inputaudiosensitivecontentdetected')) {
            return VideoGenerateErrorCode::INPUT_AUDIO_AUDIT_FAILED;
        }
        if (str_starts_with($code, 'outputtextsensitivecontentdetected')) {
            return VideoGenerateErrorCode::OUTPUT_TEXT_AUDIT_FAILED;
        }
        // 输出视频审核失败
        if (str_starts_with($code, 'outputvideosensitivecontentdetected')) {
            return VideoGenerateErrorCode::OUTPUT_VIDEO_AUDIT_FAILED;
        }
        if (str_starts_with($code, 'outputaudiosensitivecontentdetected')) {
            return VideoGenerateErrorCode::OUTPUT_AUDIO_AUDIT_FAILED;
        }
        if (str_starts_with($code, 'invalidprompt') || str_starts_with($code, 'promptcheckfailed') || str_starts_with($code, 'promptblocked')) {
            return VideoGenerateErrorCode::INVALID_PROMPT;
        }
        // 分辨率或时长不支持
        if (str_starts_with($code, 'invalidparameterinvalidresolution') || str_starts_with($code, 'invalidparameterinvalidvideoduration')) {
            return VideoGenerateErrorCode::INVALID_PARAMETER;
        }
        // 素材格式不支持
        if (str_starts_with($code, 'invalidfileformat') || str_starts_with($code, 'unsupportedvideoformat') || $code === 'unsupportedformat') {
            return VideoGenerateErrorCode::UNSUPPORTED_VIDEO_FORMAT;
        }
        // 音频时长过长
        if ($code === 'audiodurationtoolong') {
            return VideoGenerateErrorCode::INVALID_PARAMETER;
        }
        // 任务不存在
        if (str_starts_with($code, 'tasknotfound') || str_starts_with($code, 'resourcenotfound')) {
            return VideoGenerateErrorCode::GENERAL_ERROR;
        }
        // 任务超时
        if ($code === 'tasktimeout' || $code === 'timeout') {
            return VideoGenerateErrorCode::TASK_TIMEOUT;
        }
        // 参数错误
        if (str_starts_with($code, 'invalidparameter') || str_contains($text, 'invalidparameter')) {
            return VideoGenerateErrorCode::INVALID_PARAMETER;
        }

        return VideoGenerateErrorCode::GENERAL_ERROR;
    }

    private static function readResponseBody(RequestException $exception): ?string
    {
        $body = $exception->getResponse()?->getBody();
        if ($body === null) {
            return null;
        }
        if ($body->isSeekable()) {
            $body->rewind();
        }
        $content = (string) $body;
        if ($body->isSeekable()) {
            $body->rewind();
        }

        return $content === '' ? null : $content;
    }

    /** @return array<string, mixed> */
    private static function decodeResponseBody(?string $body): array
    {
        if ($body === null || trim($body) === '') {
            return [];
        }

        try {
            $payload = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return [];
        }

        return is_array($payload) ? $payload : [];
    }

    private static function normalize(string $value): string
    {
        return preg_replace('/[^a-z0-9]+/', '', strtolower(trim($value))) ?? '';
    }
}
