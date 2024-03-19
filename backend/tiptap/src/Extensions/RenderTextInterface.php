<?php
declare(strict_types=1);

namespace Tiptap\Extensions;

interface RenderTextInterface
{
    public function renderText($node): string;
}
