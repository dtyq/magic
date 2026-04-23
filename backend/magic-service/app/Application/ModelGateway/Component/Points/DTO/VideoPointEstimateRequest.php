<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Component\Points\DTO;

/**
 * magic-service 对外统一的视频积分预估请求，屏蔽底层计费实现细节。
 */
readonly class VideoPointEstimateRequest
{
    /**
     * 保存视频预估所需的输出规格、输入参考视频时长和业务上下文。
     *
     * @param string $modelId 视频模型 ID，用于匹配 billing.php 中的模型价格配置。
     * @param string $resolution 输出视频分辨率档位，例如 480p、720p
     * @param int $outputDurationSeconds 输出视频时长，单位秒
     * @param int $outputWidth 输出视频宽度，Seedance token 公式按宽高估算像素量
     * @param int $outputHeight 输出视频高度，Seedance token 公式按宽高估算像素量
     * @param int $inputVideoDurationSeconds 参考视频总时长，单位秒；无参考视频时为 0
     * @param bool $hasReferenceVideo 是否包含参考视频，影响部分模型的 token 单价
     * @param array<string, mixed> $businessParams 业务上下文，例如组织、用户、项目和视频任务 ID
     */
    public function __construct(
        private string $modelId,
        private string $resolution,
        private int $outputDurationSeconds,
        private int $outputWidth,
        private int $outputHeight,
        private int $inputVideoDurationSeconds,
        private bool $hasReferenceVideo,
        private array $businessParams = [],
    ) {
    }

    /**
     * 标识当前请求为视频资源预估。
     */
    public function getResourceType(): string
    {
        return 'video';
    }

    /**
     * 返回用于匹配计费配置的视频模型 ID。
     */
    public function getModelId(): string
    {
        return $this->modelId;
    }

    /**
     * 返回输出视频分辨率档位，例如 480p、720p。
     */
    public function getResolution(): string
    {
        return $this->resolution;
    }

    /**
     * 返回生成视频的输出时长，按秒计。
     */
    public function getOutputDurationSeconds(): int
    {
        return $this->outputDurationSeconds;
    }

    /**
     * 返回输出视频宽度，用于 token 模式估算像素量。
     */
    public function getOutputWidth(): int
    {
        return $this->outputWidth;
    }

    /**
     * 返回输出视频高度，用于 token 模式估算像素量。
     */
    public function getOutputHeight(): int
    {
        return $this->outputHeight;
    }

    /**
     * 返回参考视频总时长，Seedance token 预估需要把输入和输出时长相加。
     */
    public function getInputVideoDurationSeconds(): int
    {
        return $this->inputVideoDurationSeconds;
    }

    /**
     * 标识本次预估是否包含参考视频，影响部分模型的 token 单价。
     */
    public function hasReferenceVideo(): bool
    {
        return $this->hasReferenceVideo;
    }

    /**
     * 返回业务参数，供计费归属、日志和后续扩展使用。
     *
     * @return array<string, mixed>
     */
    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }

    /**
     * 转换为日志和调试使用的请求快照。
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'resource_type' => $this->getResourceType(),
            'model_id' => $this->modelId,
            'resolution' => $this->resolution,
            'output_duration_seconds' => $this->outputDurationSeconds,
            'output_width' => $this->outputWidth,
            'output_height' => $this->outputHeight,
            'input_video_duration_seconds' => $this->inputVideoDurationSeconds,
            'has_reference_video' => $this->hasReferenceVideo,
        ];
    }
}
