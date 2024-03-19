<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct;

use Closure;

use function Hyperf\Support\call;

class MagicStreamTextProcessor
{
    private const int STATE_NORMAL = 0;    // 普通文本状态

    private const int STATE_TAG_START = 1; // 可能是标签开始

    private const int STATE_IN_TAG = 2;    // 确认在标签内

    private Closure $outputCall;

    private string $tag = 'Magic';

    private string $buffer = '';

    /**
     * @var int 状态 0 普通文本，1 标签开始，2 在标签内
     */
    private int $state = 0;

    private array $successLengths;

    public function __construct(Closure $outputCall)
    {
        $this->outputCall = $outputCall;
        $this->successLengths = [
            mb_strlen('<MagicImage>') + 16 + mb_strlen('</MagicImage>'),
            mb_strlen('<MagicVideo>') + 16 + mb_strlen('</MagicVideo>'),
            mb_strlen('<MagicMention>') + 16 + mb_strlen('</MagicMention>'),
        ];
    }

    public function start(): void
    {
    }

    public function process(string $current, array $params = []): void
    {
        if (mb_strlen($current) > 1 && (str_contains($current, '<') || str_contains($current, '>'))) {
            $chars = preg_split('//u', $current, -1, PREG_SPLIT_NO_EMPTY);
            foreach ($chars as $char) {
                $this->process($char, $params);
            }
            return;
        }

        $this->buffer .= $current;

        if ($this->state === self::STATE_NORMAL) {
            if (mb_substr($this->buffer, 0, 1) === '<') {
                $this->state = self::STATE_TAG_START;
                return;
            }
            $this->output($params);
            return;
        }

        if ($this->state === self::STATE_TAG_START) {
            $tagLen = mb_strlen('<' . $this->tag);
            if (mb_strlen($this->buffer) >= $tagLen) {
                if (mb_substr($this->buffer, 0, $tagLen) === '<' . $this->tag) {
                    $this->state = self::STATE_IN_TAG;
                } else {
                    $this->output($params);
                }
            }
            return;
        }

        if ($this->state === self::STATE_IN_TAG) {
            // 如果已经检测长度已经达到最大长度，直接响应
            if (mb_strlen($this->buffer) > max($this->successLengths)) {
                $this->output($params);
                return;
            }
            if ($compressibleContent = $this->isValidTagContent()) {
                $this->output($params, $compressibleContent);
                return;
            }
            return;
        }
    }

    public function end(array $params = []): void
    {
        if ($this->buffer !== '') {
            $this->output($params);
        }
    }

    public function getBuffer(): string
    {
        return $this->buffer;
    }

    public function output(array $params = [], array $compressibleContent = []): void
    {
        call($this->outputCall, [$this->buffer, $compressibleContent, $params]);
        $this->buffer = '';
        $this->state = self::STATE_NORMAL;
    }

    private function isValidTagContent(): array
    {
        // 正则挺费性能的，先采用固定的字符串长度吧
        if (! in_array(mb_strlen($this->buffer), $this->successLengths)) {
            return [];
        }
        if (preg_match("/<{$this->tag}\\w+>(cp_[a-f0-9]+)<\\/{$this->tag}\\w+>/u", $this->buffer, $matches)) {
            return [
                'tag' => $matches[0],
                'id' => $matches[1],
            ];
        }
        return [];
    }
}
