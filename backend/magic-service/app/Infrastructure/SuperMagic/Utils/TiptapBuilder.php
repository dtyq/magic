<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\Utils;

use Hyperf\Codec\Json;

/**
 * Build Tiptap document structures programmatically.
 *
 * This is the single place in the Super Magic infrastructure that constructs
 * Tiptap JSON. Any code that needs to go from "raw data → Tiptap" should call
 * one of these static methods rather than building the array inline.
 *
 * Note: parsing / reading existing Tiptap JSON is handled by the host app's
 * TiptapUtil (App\Infrastructure\Util\Tiptap\TiptapUtil). This class is
 * intentionally write-only (builder) to keep the responsibility self-contained.
 */
class TiptapBuilder
{
    /**
     * Convert plain text to a Tiptap doc structure.
     *
     * Each newline-separated line becomes its own paragraph node so that
     * multi-line messages are rendered faithfully in the editor.
     *
     * @param string $text Raw plain text (may contain \n line breaks)
     * @return array Tiptap doc array ready for Json::encode()
     */
    public static function fromPlainText(string $text): array
    {
        $paragraphs = [];
        foreach (explode("\n", $text) as $line) {
            $paragraphs[] = [
                'type' => 'paragraph',
                'attrs' => ['suggestion' => ''],
                'content' => [['type' => 'text', 'text' => $line]],
            ];
        }

        return ['type' => 'doc', 'content' => $paragraphs];
    }

    /**
     * Encode a Tiptap doc array to a JSON string (ready for message_content.content).
     *
     * @param array $doc Result of fromPlainText() or a hand-crafted Tiptap doc
     */
    public static function toJson(array $doc): string
    {
        return Json::encode($doc);
    }

    /**
     * Shorthand: convert plain text directly to the JSON string that
     * message_content.content expects.
     */
    public static function plainTextToJson(string $text): string
    {
        return self::toJson(self::fromPlainText($text));
    }

    public static function plainTextWithMentionsToJson(string $text, array $nodes): string
    {
        $doc = self::fromPlainText($text);
        if ($nodes !== []) {
            $content = [];
            foreach ($nodes as $node) {
                if ($content !== []) {
                    $content[] = ['type' => 'text', 'text' => ' '];
                }
                $content[] = $node;
            }
            $doc['content'][] = ['type' => 'paragraph', 'content' => $content];
        }
        return self::toJson($doc);
    }
}
