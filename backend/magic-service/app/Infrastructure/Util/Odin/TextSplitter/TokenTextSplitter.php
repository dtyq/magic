<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Odin\TextSplitter;

use Exception;
use Hyperf\Context\Context;
use Hyperf\Odin\TextSplitter\TextSplitter;
use Throwable;
use Yethee\Tiktoken\Encoder;
use Yethee\Tiktoken\EncoderProvider;

class TokenTextSplitter extends TextSplitter
{
    /**
     * 设置最大缓存文本长度（字符数）
     * 超过此长度的文本将不会被缓存在协程上下文中.
     */
    private const int MAX_CACHE_TEXT_LENGTH = 1000;

    protected $chunkSize;

    protected $chunkOverlap;

    protected $keepSeparator;

    private string $fixedSeparator;

    private array $separators;

    /**
     * @var callable token计算闭包
     */
    private $tokenizer;

    /**
     * 默认token计算闭包使用到的encoderProvider.
     */
    private EncoderProvider $defaultEncoderProvider;

    /**
     * 默认token计算闭包使用到的encoder.
     */
    private Encoder $defaultEncoder;

    /**
     * @var bool 分割后的文本保留分隔符
     */
    private bool $preserveSeparator = false;

    /**
     * @param null|callable $tokenizer token计算函数
     * @param null|array $separators 备选分隔符列表
     * @throws Exception
     */
    public function __construct(
        ?callable $tokenizer = null,
        int $chunkSize = 1000,
        int $chunkOverlap = 200,
        string $fixedSeparator = "\n\n",
        ?array $separators = null,
        bool $keepSeparator = false,
        bool $preserveSeparator = false
    ) {
        $this->chunkSize = $chunkSize;
        $this->chunkOverlap = $chunkOverlap;
        $this->fixedSeparator = $fixedSeparator;
        $this->separators = $separators ?? ["\n\n", "\n", '。', ' ', ''];
        $this->tokenizer = $tokenizer ?? $this->getDefaultTokenizer();
        $this->keepSeparator = $keepSeparator;
        $this->preserveSeparator = $preserveSeparator;
        parent::__construct($chunkSize, $chunkOverlap, $keepSeparator);
    }

    /**
     * 分割文本.
     *
     * @param string $text 要分割的文本
     * @return array 分割后的文本块数组
     */
    public function splitText(string $text): array
    {
        $text = $this->ensureUtf8Encoding($text);

        // 保存原始文本，用于还原标签
        $originalText = $text;

        // 1. 先把原文中的0x00替换成0x000x00
        $text = str_replace("\x00", "\x00\x00", $text);

        // 2. 把标签替换成0x00
        $text = preg_replace('/<MagicCompressibleContent.*?<\/MagicCompressibleContent>/s', "\x00", $text);

        // 3. 分割文本
        if ($this->fixedSeparator) {
            $chunks = $this->splitBySeparator($text, $this->fixedSeparator);
        } else {
            $chunks = [$text];
        }

        // 计算每个chunk的token长度
        $chunksLengths = array_map(function ($chunk) {
            return ($this->tokenizer)($chunk);
        }, $chunks);

        $finalChunks = [];
        foreach ($chunks as $i => $chunk) {
            if ($chunksLengths[$i] > $this->chunkSize) {
                // 如果chunk太大，进行递归分割
                $finalChunks = array_merge($finalChunks, $this->recursiveSplitText($chunk));
            } else {
                $finalChunks[] = $chunk;
            }
        }

        // 4. 还原文本
        // 先获取所有标签
        preg_match_all('/<MagicCompressibleContent.*?<\/MagicCompressibleContent>/s', $originalText, $matches);
        $tags = $matches[0];
        $tagIndex = 0;

        return array_map(function ($chunk) use ($tags, &$tagIndex) {
            // 还原0x000x00为0x00
            $chunk = str_replace("\x00\x00", "\x00", $chunk);
            // 还原标签
            return preg_replace_callback('/\x00/', function () use ($tags, &$tagIndex) {
                return $tags[$tagIndex++] ?? '';
            }, $chunk);
        }, $finalChunks);
    }

    /**
     * 合并文本块.
     *
     * @param array $splits 要合并的文本块
     * @param string $separator 分隔符
     * @return array 合并后的文本块数组
     */
    protected function mergeSplits(array $splits, string $separator): array
    {
        $merged = [];
        $currentChunk = '';
        $currentLength = 0;

        foreach ($splits as $split) {
            $length = ($this->tokenizer)($split);

            if ($currentLength + $length > $this->chunkSize) {
                if ($currentChunk !== '') {
                    $merged[] = $currentChunk;
                }
                $currentChunk = $split;
                $currentLength = $length;
            } else {
                if ($currentChunk !== '') {
                    $currentChunk .= $separator;
                }
                $currentChunk .= $split;
                $currentLength += $length;
            }
        }

        if ($currentChunk !== '') {
            $merged[] = $currentChunk;
        }

        return $merged;
    }

    /**
     * 使用指定分隔符分割文本.
     */
    private function splitBySeparator(string $text, string $separator): array
    {
        if ($separator === ' ') {
            $chunks = preg_split('/\s+/', $text);
        } else {
            // 如果分隔符包含0x00，替换成0x000x00
            $separator = str_replace("\x00", "\x00\x00", $separator);
            $chunks = explode($separator, $text);
            if ($this->preserveSeparator) {
                $chunks = $this->preserveSeparator($chunks, $separator);
            }
        }
        return array_values(array_filter($chunks, function ($chunk) {
            return $chunk !== '' && $chunk !== "\n";
        }));
    }

    /**
     * 处理分隔符，将分隔符拼接到每个分块的前面（除了第一个）.
     */
    private function preserveSeparator(array $chunks, string $separator): array
    {
        return array_map(function ($chunk, $index) use ($separator) {
            return $index > 0 ? $separator . $chunk : $chunk;
        }, $chunks, array_keys($chunks));
    }

    /**
     * 检测并转换文本编码
     */
    private function ensureUtf8Encoding(string $text): string
    {
        $encoding = $this->detectEncoding($text);
        if ($encoding !== 'UTF-8') {
            return mb_convert_encoding($text, 'UTF-8', $encoding);
        }
        return $text;
    }

    /**
     * 按固定长度分割文本.
     */
    private function splitByFixedLength(string $text): array
    {
        $chunkSize = (int) floor($this->chunkSize / 2); // 使用较小的块大小
        $length = mb_strlen($text);
        $splits = [];
        for ($i = 0; $i < $length; $i += $chunkSize) {
            $splits[] = mb_substr($text, $i, $chunkSize);
        }
        return $splits;
    }

    /**
     * 处理无分隔符的文本分割.
     */
    private function handleNoSeparatorSplits(array $splits, array $splitLengths): array
    {
        $finalChunks = [];
        $currentPart = '';
        $currentLength = 0;
        $overlapPart = '';
        $overlapLength = 0;

        foreach ($splits as $i => $split) {
            $splitLength = $splitLengths[$i];

            if ($currentLength + $splitLength <= $this->chunkSize - $this->chunkOverlap) {
                $currentPart .= $split;
                $currentLength += $splitLength;
            } elseif ($currentLength + $splitLength <= $this->chunkSize) {
                $currentPart .= $split;
                $currentLength += $splitLength;
                $overlapPart .= $split;
                $overlapLength += $splitLength;
            } else {
                $finalChunks[] = $currentPart;
                $currentPart = $overlapPart . $split;
                $currentLength = $splitLength + $overlapLength;
                $overlapPart = '';
                $overlapLength = 0;
            }
        }

        if ($currentPart !== '') {
            $finalChunks[] = $currentPart;
        }

        return $finalChunks;
    }

    /**
     * 递归分割文本.
     *
     * @param string $text 要分割的文本
     * @return array 分割后的文本块数组
     */
    private function recursiveSplitText(string $text, int $separatorBeginIndex = 0): array
    {
        $finalChunks = [];
        $separator = end($this->separators);
        $newSeparators = [];

        // 查找合适的分隔符, 从$separatorBeginIndex开始
        for ($i = $separatorBeginIndex; $i < count($this->separators); ++$i) {
            $sep = $this->separators[$i];
            if ($sep === '') {
                $separator = $sep;
                break;
            }
            if (str_contains($text, $sep)) {
                $separator = $sep;
                $newSeparators = array_slice($this->separators, $i + 1);
                break;
            }
        }
        $separatorBeginIndex = min($i + 1, count($this->separators));

        // 使用选定的分隔符分割文本
        if ($separator !== '') {
            $splits = $this->splitBySeparator($text, $separator);
        } else {
            $splits = $this->splitByFixedLength($text);
        }

        // 计算每个split的token长度
        $splitLengths = array_map(function ($split) {
            return ($this->tokenizer)($split);
        }, $splits);

        if ($separator !== '') {
            // 处理有分隔符的情况
            $goodSplits = [];
            $goodSplitsLengths = [];
            $actualSeparator = $this->keepSeparator ? $separator : '';

            foreach ($splits as $i => $split) {
                $splitLength = $splitLengths[$i];

                if ($splitLength < $this->chunkSize) {
                    $goodSplits[] = $split;
                    $goodSplitsLengths[] = $splitLength;
                } else {
                    if (! empty($goodSplits)) {
                        $mergedText = $this->mergeSplits($goodSplits, $actualSeparator);
                        $finalChunks = array_merge($finalChunks, $mergedText);
                        $goodSplits = [];
                        $goodSplitsLengths = [];
                    }

                    if (empty($newSeparators)) {
                        $finalChunks[] = $split;
                    } else {
                        $finalChunks = array_merge(
                            $finalChunks,
                            $this->recursiveSplitText($split, $separatorBeginIndex)
                        );
                    }
                }
            }

            if (! empty($goodSplits)) {
                $mergedText = $this->mergeSplits($goodSplits, $actualSeparator);
                $finalChunks = array_merge($finalChunks, $mergedText);
            }
        } else {
            $finalChunks = $this->handleNoSeparatorSplits($splits, $splitLengths);
        }

        return $finalChunks;
    }

    /**
     * 计算文本的token数量.
     */
    private function calculateTokenCount(string $text): int
    {
        try {
            if (! isset($this->defaultEncoderProvider)) {
                $this->defaultEncoderProvider = new EncoderProvider();
                $this->defaultEncoder = $this->defaultEncoderProvider->getForModel('gpt-4');
            }
            return count($this->defaultEncoder->encode($text));
        } catch (Throwable $e) {
            // 如果计算token失败，返回一个估计值
            return (int) ceil(mb_strlen($text) / 4);
        }
    }

    private function getDefaultTokenizer(): callable
    {
        return function (string $text) {
            // 如果文本长度超过限制，直接计算不缓存
            if (mb_strlen($text) > self::MAX_CACHE_TEXT_LENGTH) {
                return $this->calculateTokenCount($text);
            }

            // 生成上下文键
            $contextKey = 'token_count:' . md5($text);

            // 尝试从协程上下文获取
            $count = Context::get($contextKey);
            if ($count !== null) {
                return $count;
            }

            // 计算 token 数量
            $count = $this->calculateTokenCount($text);

            // 存储到协程上下文
            Context::set($contextKey, $count);

            return $count;
        };
    }

    /**
     * 检测文件内容的编码
     */
    private function detectEncoding(string $content): string
    {
        // 检查 BOM
        if (str_starts_with($content, "\xEF\xBB\xBF")) {
            return 'UTF-8';
        }
        if (str_starts_with($content, "\xFF\xFE")) {
            return 'UTF-16LE';
        }
        if (str_starts_with($content, "\xFE\xFF")) {
            return 'UTF-16BE';
        }

        // 尝试检测编码
        $encoding = mb_detect_encoding($content, ['UTF-8', 'GBK', 'GB2312', 'BIG5', 'ASCII'], true);
        if ($encoding === false) {
            // 如果无法检测到编码，尝试使用 iconv 检测
            $encoding = mb_detect_encoding($content, ['UTF-8', 'GBK', 'GB2312', 'BIG5', 'ASCII'], false);
            if ($encoding === false) {
                return 'UTF-8'; // 默认使用 UTF-8
            }
        }

        return $encoding;
    }
}
