<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Memory\MultiModal;

use App\Application\Flow\ExecuteManager\Attachment\AttachmentInterface;

/**
 * 多模态内容格式化工具
 * 用于统一处理不同场景下的多模态内容格式化.
 */
class MultiModalContentFormatter
{
    /**
     * 将所有附件格式化到文本中.
     *
     * @param string $originalContent 原始文本内容
     * @param string $visionResponse 视觉分析结果
     * @param AttachmentInterface[] $attachments 所有附件数组
     * @return string 格式化后的文本内容
     */
    public static function formatAllAttachments(
        string $originalContent,
        string $visionResponse,
        array $attachments,
    ): string {
        if (empty($attachments)) {
            return $originalContent;
        }

        // 分离图片和非图片附件
        $imageAttachments = [];
        $nonImageAttachments = [];

        foreach ($attachments as $attachment) {
            if ($attachment->isImage()) {
                $imageAttachments[] = $attachment;
            } else {
                $nonImageAttachments[] = $attachment;
            }
        }

        // 处理非图片附件
        $content = self::formatNonImageAttachments($originalContent, $nonImageAttachments);

        // 处理图片附件
        return self::formatImageContent($content, $visionResponse, $imageAttachments);
    }

    /**
     * 格式化图片内容到文本
     * 支持单张图片和多张图片场景.
     *
     * @param string $originalContent 原始文本内容
     * @param string $visionResponse 视觉分析结果
     * @param AttachmentInterface[] $imageAttachments 图片附件数组
     * @return string 添加了图片信息的文本内容
     */
    protected static function formatImageContent(
        string $originalContent,
        string $visionResponse,
        array $imageAttachments
    ): string {
        // 如果没有图片附件，直接返回原始内容
        if (empty($imageAttachments)) {
            return $originalContent;
        }

        $content = $originalContent;

        if (! empty($content)) {
            $content .= "\n\n";
        }
        $content .= "<图片组 描述=\"{$visionResponse}\">\n";
        foreach ($imageAttachments as $attachment) {
            $url = $attachment->getUrl();
            $name = $attachment->getName();
            if (! empty($url)) {
                $content .= "  ![{$name}]({$url})\n";
            }
        }
        $content .= '</图片组>';
        return $content;
    }

    /**
     * 格式化非图片附件到文本.
     *
     * @param string $originalContent 原始文本内容
     * @param AttachmentInterface[] $nonImageAttachments 非图片附件数组
     * @return string 添加了非图片附件信息的文本内容
     */
    protected static function formatNonImageAttachments(
        string $originalContent,
        array $nonImageAttachments
    ): string {
        // 如果没有附件，直接返回原始内容
        if (empty($nonImageAttachments)) {
            return $originalContent;
        }

        $content = $originalContent;

        // 添加非图片附件的链接
        foreach ($nonImageAttachments as $attachment) {
            $url = $attachment->getUrl();
            $name = $attachment->getName();
            if (! empty($url)) {
                if (! empty($content)) {
                    $content .= ' ';
                }
                $content .= "[{$name}]({$url})";
            }
        }

        return $content;
    }
}
