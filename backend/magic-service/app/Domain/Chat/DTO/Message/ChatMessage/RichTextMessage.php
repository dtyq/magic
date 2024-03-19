<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Infrastructure\Util\Tiptap\CustomExtension\ImageNode;
use App\Infrastructure\Util\Tiptap\TiptapUtil;
use Hyperf\Codec\Json;
use Tiptap\Editor;

class RichTextMessage extends AbstractAttachmentMessage implements TextContentInterface
{
    protected string $content = '';

    public function setContent(array|string $content): void
    {
        $this->content = is_array($content) ? Json::encode($content) : $content;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function getTextContent(): string
    {
        return TiptapUtil::getTextContent($this->getContent());
    }

    public function getFileIds(): array
    {
        $attachmentIds = $this->getAttachmentIds();
        // 检查富文本中是否有图片
        $content = $this->getContent();
        $editor = new Editor([
            'extensions' => [
                new ImageNode(),
            ],
        ]);
        $richTextContent = $editor->setContent($content)->getJSON();
        $richTextContent = Json::decode($richTextContent);
        if (is_array($richTextContent) && ! empty($richTextContent)) {
            $imageIds = $this->findImageFileIds($richTextContent);
            $attachmentIds = array_values(array_unique(array_merge($attachmentIds, $imageIds)));
        }
        return $attachmentIds;
    }

    /**
     * 递归查找所有图片节点的 file_id.
     *
     * @param array $data 要搜索的数据数组
     * @param int $maxDepth 最大递归深度
     * @return array<string> 返回找到的所有 file_id 的数组
     */
    public function findImageFileIds(array $data, int $maxDepth = 512, int $currentDepth = 0): array
    {
        $fileIds = [];

        if ($currentDepth > $maxDepth) {
            return $fileIds;
        }

        foreach ($data as $key => $value) {
            if ($key === 'type' && $value === 'image' && isset($data['attrs']['file_id'])) {
                $fileIds[] = $data['attrs']['file_id'];
            } elseif ($key === 'content' && is_array($value)) {
                foreach ($value as $item) {
                    if (is_array($item)) {
                        $fileIds = array_merge($fileIds, $this->findImageFileIds($item, $maxDepth, $currentDepth + 1));
                    }
                }
            }
        }

        return $fileIds;
    }

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::RichText;
    }
}
