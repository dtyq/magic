<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\DocumentSplitter;

use Hyperf\Context\ApplicationContext;
use InvalidArgumentException;

enum DocumentSplitterSwitch: string
{
    case Auto = 'auto';
    case OdinRecursiveCharacterTextSplitter = 'odin_recursive_character_text_splitter';
    case OdinMarkdownSplitter = 'odin_markdown_splitter';
    case DouAISplitter = 'dou_ai_splitter';

    public static function getDefault(): DocumentSplitterSwitch
    {
        return DocumentSplitterSwitch::DouAISplitter;
    }

    public function getSplitter(): DocumentSplitterInterface
    {
        $container = ApplicationContext::getContainer();
        if ($this === self::Auto) {
            return $container->get(DocumentSplitterInterface::class);
        }

        return match ($this) {
            self::OdinRecursiveCharacterTextSplitter => $container->get(OdinRecursiveCharacterTextSplitter::class),
            self::OdinMarkdownSplitter => $container->get(OdinMarkdownSplitter::class),
            default => throw new InvalidArgumentException('Invalid splitter type'),
        };
    }
}
