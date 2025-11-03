<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\ValueObject;

/**
 * 火山引擎语音识别状态码枚举.
 */
enum VolcengineStatusCode: string
{
    /**
     * 成功 - 响应body包含转录结果.
     */
    case SUCCESS = '20000000';

    /**
     * 正在处理中 - 响应body为空.
     */
    case PROCESSING = '20000001';

    /**
     * 任务在队列中 - 响应body为空.
     */
    case QUEUED = '20000002';

    /**
     * 静音音频 - 无需重新query，直接重新submit.
     */
    case SILENT_AUDIO = '20000003';

    /**
     * 请求参数无效.
     */
    case INVALID_PARAMS = '45000001';

    /**
     * 空音频.
     */
    case EMPTY_AUDIO = '45000002';

    /**
     * 音频格式不正确.
     */
    case INVALID_AUDIO_FORMAT = '45000151';

    /**
     * 服务器繁忙.
     */
    case SERVER_BUSY = '55000031';

    /**
     * 判断是否为成功状态
     */
    public function isSuccess(): bool
    {
        return $this === self::SUCCESS;
    }

    /**
     * 判断是否为处理中状态（包括处理中和排队中）.
     */
    public function isProcessing(): bool
    {
        return in_array($this, [self::PROCESSING, self::QUEUED]);
    }

    /**
     * 判断是否为失败状态
     */
    public function isFailed(): bool
    {
        return ! $this->isSuccess() && ! $this->isProcessing();
    }

    /**
     * 判断是否为可重试的失败状态
     */
    public function isRetryable(): bool
    {
        return in_array($this, [self::SERVER_BUSY]);
    }

    /**
     * 判断是否需要重新提交任务
     */
    public function needsResubmit(): bool
    {
        return $this === self::SILENT_AUDIO;
    }

    /**
     * 获取状态码的描述信息.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::SUCCESS => '识别成功',
            self::PROCESSING => '正在处理中',
            self::QUEUED => '任务在队列中',
            self::SILENT_AUDIO => '静音音频',
            self::INVALID_PARAMS => '请求参数无效',
            self::EMPTY_AUDIO => '空音频',
            self::INVALID_AUDIO_FORMAT => '音频格式不正确',
            self::SERVER_BUSY => '服务器繁忙',
        };
    }

    /**
     * 根据状态码字符串创建枚举实例.
     */
    public static function fromString(string $statusCode): ?self
    {
        return self::tryFrom($statusCode);
    }

    /**
     * 判断是否为服务内部错误（550xxxx系列）.
     */
    public static function isInternalServerError(string $statusCode): bool
    {
        return str_starts_with($statusCode, '550');
    }
}
