<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionInterface;
use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Agent\Assembler\MentionAssembler;
use Hyperf\Codec\Json;

class SuperAgentExtra extends AbstractDTO
{
    /**
     * Mention related data for @ references.
     * @var null|MentionInterface[]
     */
    protected ?array $mentions;

    /**
     * Input mode: chat | plan (only effective in general mode, deprecated in new version).
     */
    protected ?string $inputMode;

    /**
     * Chat mode: normal | follow_up | interrupt.
     */
    protected ?string $chatMode;

    /**
     * Task pattern: general | dataAnalysis | ppt | report.
     */
    protected ?string $topicPattern;

    protected ?array $model = null;

    protected ?array $imageModel = null;

    /**
     * Queue ID for message processing.
     */
    protected ?string $queueId;

    /**
     * 动态参数（用于向沙箱传递额外参数，如 task_key 等）.
     */
    protected ?array $dynamicParams;

    /**
     * Whether to enable web search. Default is true for backward compatibility.
     */
    protected ?bool $enableWebSearch = null;

    /**
     * 获取 mentions 的 JSON 结构数组.
     */
    public function getMentionsJsonStruct(): ?array
    {
        $jsonStruct = [];
        foreach ($this->getMentions() ?? [] as $mention) {
            $mentionJson = $mention->getMentionJsonStruct();
            if (! empty($mentionJson)) {
                $jsonStruct[] = $mentionJson;
            }
        }
        if (empty($jsonStruct)) {
            return null;
        }
        return $jsonStruct;
    }

    public function getMentions(): ?array
    {
        return $this->mentions ?? null;
    }

    public function setMentions(?array $mentions): void
    {
        if (empty($mentions)) {
            return;
        }
        $converted = [];
        foreach ($mentions as $mention) {
            if ($mention instanceof MentionInterface) {
                $converted[] = $mention;
                continue;
            }

            if (! is_array($mention)) {
                continue;
            }

            $mentionObj = MentionAssembler::fromArray($mention);
            if ($mentionObj instanceof MentionInterface) {
                $converted[] = $mentionObj;
            }
        }
        $this->mentions = $converted;
    }

    public function getInputMode(): ?string
    {
        return $this->inputMode ?? null;
    }

    public function setInputMode(?string $inputMode): void
    {
        $this->inputMode = $inputMode;
    }

    public function getChatMode(): ?string
    {
        return $this->chatMode ?? null;
    }

    public function setChatMode(?string $chatMode): void
    {
        $this->chatMode = $chatMode;
    }

    public function getTopicPattern(): ?string
    {
        return $this->topicPattern ?? null;
    }

    public function setTopicPattern(?string $topicPattern): void
    {
        $this->topicPattern = $topicPattern;
    }

    public function getModel(): ?array
    {
        return $this->model;
    }

    public function getModelId(): string
    {
        if (empty($this->model)) {
            return '';
        }
        if (is_array($this->model) && isset($this->model['model_id']) && is_string($this->model['model_id'])) {
            return $this->model['model_id'];
        }
        return '';
    }

    public function setModel(?array $model): void
    {
        $this->model = $model;
    }

    public function getImageModel(): ?array
    {
        return $this->imageModel;
    }

    public function getImageModelId(): string
    {
        if (empty($this->imageModel)) {
            return '';
        }
        if (is_array($this->imageModel) && isset($this->imageModel['model_id']) && is_string($this->imageModel['model_id'])) {
            return $this->imageModel['model_id'];
        }
        return '';
    }

    public function setImageModel(?array $imageModel): void
    {
        $this->imageModel = $imageModel;
    }

    public function getQueueId(): ?string
    {
        return $this->queueId ?? null;
    }

    public function setQueueId(?string $queueId): void
    {
        $this->queueId = $queueId;
    }

    public function getDynamicParams(): ?array
    {
        return $this->dynamicParams ?? null;
    }

    public function setDynamicParams(?array $dynamicParams): void
    {
        $this->dynamicParams = $dynamicParams;
    }

    /**
     * 获取单个动态参数.
     */
    public function getDynamicParam(string $key, mixed $default = null): mixed
    {
        return $this->dynamicParams[$key] ?? $default;
    }

    /**
     * 设置单个动态参数.
     */
    public function setDynamicParam(string $key, mixed $value): void
    {
        if ($this->dynamicParams === null) {
            $this->dynamicParams = [];
        }
        $this->dynamicParams[$key] = $value;
    }

    public function getEnableWebSearch(): ?bool
    {
        return $this->enableWebSearch;
    }

    public function setEnableWebSearch(?bool $enableWebSearch): void
    {
        $this->enableWebSearch = $enableWebSearch;
    }
}
