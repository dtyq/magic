<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\DocumentSplitter;

use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\TextSplitter\RecursiveCharacterTextSplitter;

readonly class OdinRecursiveCharacterTextSplitter implements DocumentSplitterInterface
{
    public function __construct(private RecursiveCharacterTextSplitter $textSplitter)
    {
    }

    public function split(ModelInterface $model, string $text, array $options = []): array
    {
        return $this->textSplitter->splitText($text);
    }
}
