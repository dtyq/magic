<?php

namespace Tiptap\Extensions;

use Tiptap\Core\Extension;

class StarterKit extends Extension
{
    public static $name = 'starterKit';

    public function addOptions()
    {
        return [
            'document' => [],
            'blockquote' => [],
            'bulletList' => [],
            'codeBlock' => [],
            'hardBreak' => [],
            'heading' => [],
            'horizontalRule' => [],
            'listItem' => [],
            'orderedList' => [],
            'paragraph' => [],
            'text' => [],
            'bold' => [],
            'code' => [],
            'italic' => [],
            'strike' => [],
        ];
    }

    public function addExtensions()
    {
        return array_filter([
            $this->options['document'] !== false
                ? new \Tiptap\Nodes\Document($this->options['document'])
                : null,
            $this->options['blockquote'] !== false
                ? new \Tiptap\Nodes\Blockquote($this->options['blockquote'])
                : null,
            $this->options['bulletList'] !== false
                ? new \Tiptap\Nodes\BulletList($this->options['bulletList'])
                : null,
            $this->options['codeBlock'] !== false
                ? new \Tiptap\Nodes\CodeBlock($this->options['codeBlock'])
                : null,
            $this->options['hardBreak'] !== false
                ? new \Tiptap\Nodes\HardBreak($this->options['hardBreak'])
                : null,
            $this->options['heading'] !== false
                ? new \Tiptap\Nodes\Heading($this->options['heading'])
                : null,
            $this->options['horizontalRule'] !== false
                ? new \Tiptap\Nodes\HorizontalRule($this->options['horizontalRule'])
                : null,
            $this->options['listItem'] !== false
                ? new \Tiptap\Nodes\ListItem($this->options['listItem'])
                : null,
            $this->options['orderedList'] !== false
                ? new \Tiptap\Nodes\OrderedList($this->options['orderedList'])
                : null,
            $this->options['paragraph'] !== false
                ? new \Tiptap\Nodes\Paragraph($this->options['paragraph'])
                : null,
            $this->options['text'] !== false
                ? new \Tiptap\Nodes\Text($this->options['text'])
                : null,
            $this->options['bold'] !== false
                ? new \Tiptap\Marks\Bold($this->options['bold'])
                : null,
            $this->options['code'] !== false
                ? new \Tiptap\Marks\Code($this->options['code'])
                : null,
            $this->options['italic'] !== false
                ? new \Tiptap\Marks\Italic($this->options['italic'])
                : null,
            $this->options['strike'] !== false
                ? new \Tiptap\Marks\Strike($this->options['strike'])
                : null,
        ]);
    }
}
