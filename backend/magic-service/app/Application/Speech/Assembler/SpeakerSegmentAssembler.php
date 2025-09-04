<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Assembler;

use App\Infrastructure\ExternalAPI\Volcengine\DTO\Item\UtteranceDTO;

/**
 * 说话人分段装配器
 * 负责处理语音识别中说话人相关的格式化逻辑.
 */
class SpeakerSegmentAssembler
{
    /**
     * 从utterance中提取说话人ID.
     *
     * @param UtteranceDTO $utterance utterance对象
     * @return string 说话人标识
     */
    public function extractSpeakerId(UtteranceDTO $utterance): string
    {
        $additions = $utterance->getAdditions();

        // 从additions中获取speaker信息
        if (isset($additions['speaker'])) {
            return (string) $additions['speaker'];
        }

        // 如果没有speaker信息，返回默认值
        return '1';
    }

    /**
     * 格式化说话人段落（Markdown格式）.
     *
     * @param string $speakerId 说话人ID
     * @param array $segments 该说话人的所有语音段
     * @return string 格式化后的段落
     */
    public function formatSpeakerSegment(string $speakerId, array $segments): string
    {
        $texts = [];

        foreach ($segments as $segment) {
            $texts[] = $segment['text'];
        }

        $content = implode('', $texts);

        // 使用 Markdown 三级标题格式，在 markdown 渲染时更清晰
        return sprintf("### 说话人%s\n\n%s", $speakerId, $content);
    }

    /**
     * 组装分人分句的完整内容.
     *
     * @param array $utterances utterance数组
     * @return string 格式化后的分人分句内容
     */
    public function assembleSegmentedContent(array $utterances): string
    {
        if (empty($utterances)) {
            return '';
        }

        $speakerSegments = [];
        $currentSpeaker = null;
        $currentContent = [];

        foreach ($utterances as $utterance) {
            $text = trim($utterance->getText());
            if (empty($text)) {
                continue;
            }

            // 获取说话人ID
            $speakerId = $this->extractSpeakerId($utterance);

            // 如果是新的说话人，保存上一个说话人的内容
            if ($currentSpeaker !== null && $currentSpeaker !== $speakerId) {
                if (! empty($currentContent)) {
                    $speakerSegments[] = $this->formatSpeakerSegment($currentSpeaker, $currentContent);
                    $currentContent = [];
                }
            }

            $currentSpeaker = $speakerId;
            $currentContent[] = [
                'text' => $text,
                'start_time' => $utterance->getStartTime(),
                'end_time' => $utterance->getEndTime(),
            ];
        }

        // 处理最后一个说话人的内容
        if ($currentSpeaker !== null && ! empty($currentContent)) {
            $speakerSegments[] = $this->formatSpeakerSegment($currentSpeaker, $currentContent);
        }

        // 使用双换行符分隔每个说话人的内容，确保在 markdown 中正确渲染为段落
        return implode("\n\n", $speakerSegments);
    }

    /**
     * 检查是否应该使用分人分句格式.
     *
     * @param array $utterances utterance数组
     * @return bool 是否应该使用分人分句格式
     */
    public function shouldUseSpeakerSegmentation(array $utterances): bool
    {
        if (empty($utterances)) {
            return false;
        }

        // 检查是否有说话人信息
        $speakers = [];
        foreach ($utterances as $utterance) {
            $additions = $utterance->getAdditions();
            if (isset($additions['speaker'])) {
                $speakers[] = $additions['speaker'];
            }
        }

        // 如果有说话人信息，就使用分人分句格式
        return ! empty($speakers);
    }
}
