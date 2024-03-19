<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap;

use App\Infrastructure\Util\Tiptap\CustomExtension\HardBreakTextNode;
use App\Infrastructure\Util\Tiptap\CustomExtension\ImageNode;
use App\Infrastructure\Util\Tiptap\CustomExtension\MagicEmojiNode;
use App\Infrastructure\Util\Tiptap\CustomExtension\MentionNode;
use App\Infrastructure\Util\Tiptap\CustomExtension\QuickInstruction\QuickInstructionNode;
use Tiptap\Editor;

class TiptapUtil
{
    public static function getTextContent(string $content): string
    {
        return self::getEditor()
            ->setContent($content)
            ->getText([
                'blockSeparator' => '',
            ]);
    }

    public static function getHtmlContent(string $content): string
    {
        return self::getEditor()
            ->setContent($content)
            ->getHtml();
    }

    public static function getJsonContent(string $content): string
    {
        return self::getEditor()
            ->setContent($content)
            ->getJson();
    }

    public static function getDocumentContent(string $content): string
    {
        return self::getEditor()
            ->setContent($content)
            ->getDocument();
    }

    private static function getEditor(): Editor
    {
        return new Editor([
            'extensions' => [
                new QuickInstructionNode(),
                new MentionNode(),
                new ImageNode(),
                new MagicEmojiNode(),
                new HardBreakTextNode(),
            ],
        ]);
    }
}
