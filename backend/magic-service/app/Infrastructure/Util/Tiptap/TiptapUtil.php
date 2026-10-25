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
use JsonException;
use Tiptap\Editor;

class TiptapUtil
{
    public static function getTextContent(string $content): string
    {
        $content = self::sanitizeContent($content);
        if ($content === '') {
            return '';
        }

        return self::getEditor()
            ->setContent($content)
            ->getText([
                'blockSeparator' => "\n",
            ]);
    }

    public static function getHtmlContent(string $content): string
    {
        $content = self::sanitizeContent($content);
        if ($content === '') {
            return '';
        }

        return self::getEditor()
            ->setContent($content)
            ->getHtml();
    }

    public static function getJsonContent(string $content): string
    {
        $content = self::sanitizeContent($content);
        if ($content === '') {
            return '';
        }

        return self::getEditor()
            ->setContent($content)
            ->getJson();
    }

    public static function getDocumentContent(string $content): string
    {
        $content = self::sanitizeContent($content);
        if ($content === '') {
            return '';
        }

        return self::getEditor()
            ->setContent($content)
            ->getDocument();
    }

    /**
     * Normalize rich-text JSON before handing it to Tiptap.
     *
     * A client-side preview can truncate an emoji between its UTF-16 surrogate
     * code units, producing an escape such as ``\\ud83c…``. PHP rejects that
     * JSON, while Tiptap then incorrectly falls back to HTML parsing. Keep
     * valid surrogate pairs, remove isolated pairs, and reject non-JSON input
     * so malformed content cannot reach the DOM parser.
     */
    public static function sanitizeContent(string $content): string
    {
        $content = self::normalizeSurrogateEscapes($content);

        try {
            json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return '';
        }

        return $content;
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

    private static function normalizeSurrogateEscapes(string $content): string
    {
        $pairs = [];
        $content = preg_replace_callback(
            '/\\\u([dD][89aAbB][0-9a-fA-F]{2})\\\u([dD][c-fC-F][0-9a-fA-F]{2})/',
            static function (array $matches) use (&$pairs): string {
                $placeholder = '__MAGIC_SURROGATE_PAIR_' . count($pairs) . '__';
                $pairs[$placeholder] = $matches[0];

                return $placeholder;
            },
            $content
        );
        if ($content === null) {
            return '';
        }

        $content = preg_replace(
            [
                '/\\\u[dD][89aAbB][0-9a-fA-F]{2}/',
                '/\\\u[dD][c-fC-F][0-9a-fA-F]{2}/',
            ],
            '',
            $content
        );
        if ($content === null) {
            return '';
        }

        return strtr($content, $pairs);
    }
}
