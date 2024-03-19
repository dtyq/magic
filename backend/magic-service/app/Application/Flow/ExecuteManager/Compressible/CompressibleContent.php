<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Compressible;

use Psr\SimpleCache\CacheInterface;

class CompressibleContent
{
    /**
     * 需要处理的压缩标签.
     */
    private static array $tags = [
        ['<MagicCompressibleContent Type="Image">', '</MagicCompressibleContent>', '<MagicImage>', '</MagicImage>'],
        ['<MagicCompressibleContent Type="Video">', '</MagicCompressibleContent>', '<MagicVideo>', '</MagicVideo>'],
        ['<MagicCompressibleContent Type="Mention">', '</MagicCompressibleContent>', '<MagicMention>', '</MagicMention>'],
    ];

    public static function compress(string $content): string
    {
        $before = $content;
        foreach (self::$tags as $tag) {
            $content = self::compressByTag($content, $tag);
        }
        simple_logger('CompressibleContent')->debug('compress', [
            'before' => $before,
            'after' => $content,
        ]);
        return $content;
    }

    public static function deCompress(string $content, bool $withTag = true): string
    {
        $before = $content;
        foreach (self::$tags as $tag) {
            $content = self::deCompressByTag($content, $tag, $withTag);
        }
        $content = self::deCompressByCompatible($content);

        simple_logger('CompressibleContent')->debug('de_compress', [
            'before' => $before,
            'after' => $content,
            'with_tag' => $withTag,
        ]);
        return $content;
    }

    private static function compressByTag(string $content, array $tag): string
    {
        [$startTag, $endTag, $startShortTag, $endShortTag] = $tag;
        $pattern = sprintf('/%s(.*?)%s/s', preg_quote($startTag, '/'), preg_quote($endTag, '/'));
        return preg_replace_callback($pattern, function ($matches) use ($startShortTag, $endShortTag) {
            $id = uniqid('cp_');
            self::saveContext($id, $matches[1]);
            return sprintf("{$startShortTag}%s{$endShortTag}", $id);
        }, $content);
    }

    private static function deCompressByTag(string $content, array $tag, bool $withTag = true): string
    {
        [$startTag, $endTag, $startShortTag, $endShortTag] = $tag;
        $pattern = sprintf('/%s(.*?)%s/s', preg_quote($startShortTag, '/'), preg_quote($endShortTag, '/'));
        preg_match_all($pattern, $content, $matches);
        foreach ($matches[0] as $index => $match) {
            $id = $matches[1][$index] ?? null;
            if (is_null($id)) {
                continue;
            }
            $originalContent = self::getContent($id);
            if (is_null($originalContent)) {
                continue;
            }
            if ($withTag) {
                $originalContent = sprintf("{$startTag}%s{$endTag}", $originalContent);
            }
            $content = str_replace($match, $originalContent, $content);
        }
        return $content;
    }

    private static function deCompressByCompatible(string $content): string
    {
        // 解压时，可能少了标签，那么尝试对 cp_ 开头的内容进行解压
        preg_match_all('/cp_[a-f0-9]{13}/', $content, $matches);
        foreach ($matches[0] as $match) {
            $id = $match;
            $originalContent = self::getContent($id);
            if (is_null($originalContent)) {
                continue;
            }
            $content = str_replace($match, $originalContent, $content);
        }
        return $content;
    }

    private static function saveContext(string $id, string $content): void
    {
        $id = 'compressible_content_' . $id;
        di(CacheInterface::class)->set($id, $content, 120);
    }

    private static function getContent(string $id): ?string
    {
        $id = 'compressible_content_' . $id;
        return di(CacheInterface::class)->get($id);
    }
}
