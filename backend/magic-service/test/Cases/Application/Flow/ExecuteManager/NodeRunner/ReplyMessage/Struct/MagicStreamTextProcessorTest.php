<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct;

use App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct\MagicStreamTextProcessor;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class MagicStreamTextProcessorTest extends ExecuteManagerBaseTest
{
    public function testNormal()
    {
        $text = '123456';
        $length = strlen($text);
        $result = [];
        $processor = new MagicStreamTextProcessor(function (string $data) use (&$result) {
            $result[] = $data;
        });
        $processor->start();
        for ($i = 0; $i < $length; ++$i) {
            $current = $text[$i];
            $processor->process($current);
        }
        $processor->end();
        $this->assertEquals(['1', '2', '3', '4', '5', '6'], $result);
    }

    public function testImage()
    {
        $text = '12<MagicImage>cp_67b5aac969f26</MagicImage>34';
        $length = strlen($text);
        $result = [];
        $processor = new MagicStreamTextProcessor(function (string $data, array $compressibleContent) use (&$result) {
            $result[] = $data;
            if (! empty($compressibleContent)) {
                var_dump($compressibleContent);
                var_dump($data);
            }
        });
        $processor->start();
        for ($i = 0; $i < $length; ++$i) {
            $current = $text[$i];
            $processor->process($current);
        }
        $processor->end();
        $this->assertEquals(['1', '2', '<MagicImage>cp_67b5aac969f26</MagicImage>', '3', '4'], $result);
    }

    public function testVideo()
    {
        $text = '<MagicVideo>cp_67b5aac969f26</MagicVideo>gg';
        $length = strlen($text);
        $result = [];
        $processor = new MagicStreamTextProcessor(function (string $data, array $compressibleContent) use (&$result) {
            $result[] = $data;
            if (! empty($compressibleContent)) {
                var_dump($compressibleContent);
                var_dump($data);
            }
        });
        $processor->start();
        for ($i = 0; $i < $length; ++$i) {
            $current = $text[$i];
            $processor->process($current);
        }
        $processor->end();
        $this->assertEquals(['<MagicVideo>cp_67b5aac969f26</MagicVideo>', 'g', 'g'], $result);
    }

    public function testError()
    {
        $text = '<MagicV>v<>xr';
        $length = strlen($text);
        $result = [];
        $processor = new MagicStreamTextProcessor(function (string $data) use (&$result) {
            $result[] = $data;
        });
        $processor->start();
        for ($i = 0; $i < $length; ++$i) {
            $current = $text[$i];
            $processor->process($current);
        }
        $processor->end();
        $this->assertEquals(['<MagicV>v<>xr'], $result);
    }

    public function testMaxLength()
    {
        $text = '<MagicVideo>v<>xr111111111112222222333444</MagicVideo>';
        $length = strlen($text);
        $result = [];
        $processor = new MagicStreamTextProcessor(function (string $data) use (&$result) {
            $result[] = $data;
        });
        $processor->start();
        for ($i = 0; $i < $length; ++$i) {
            $current = $text[$i];
            $processor->process($current);
        }
        $processor->end();
        $this->assertEquals(['<MagicVideo>v<>xr111111111112222222333444</Mag', 'i', 'c', 'V', 'i', 'd', 'e', 'o', '>'], $result);
    }

    public function testMixedTags()
    {
        $text = '1<MagicImage>cp_67b5aac969f26</MagicImage>3<MagicVideo>cp_67b5aac969f26</MagicVideo>5';
        $length = strlen($text);
        $result = [];
        $processor = new MagicStreamTextProcessor(function (string $data) use (&$result) {
            $result[] = $data;
        });
        $processor->start();
        for ($i = 0; $i < $length; ++$i) {
            $current = $text[$i];
            $processor->process($current);
        }
        $processor->end();
        $this->assertEquals(['1', '<MagicImage>cp_67b5aac969f26</MagicImage>', '3', '<MagicVideo>cp_67b5aac969f26</MagicVideo>', '5'], $result);
    }

    public function testMore()
    {
        $text = ['1', '2 <M', 'agicImage>cp_67b5aac969f26</MagicImage>', '3', '<MagicVideo>cp_67b5aac969f26</MagicVideo>', '5'];

        $processor = new MagicStreamTextProcessor(function (string $data) use (&$result) {
            $result[] = $data;
        });
        $processor->start();
        foreach ($text as $current) {
            $processor->process($current);
        }
        $processor->end();
        $this->assertEquals(['1', '2', ' ', '<MagicImage>cp_67b5aac969f26</MagicImage>', '3', '<MagicVideo>cp_67b5aac969f26</MagicVideo>', '5'], $result);
    }

    public function testHtml()
    {
        $text = ['<title>管理', 'bb</title>'];
        $processor = new MagicStreamTextProcessor(function (string $data) use (&$result) {
            $result[] = $data;
        });
        $processor->start();
        foreach ($text as $current) {
            $processor->process($current);
        }
        $processor->end();
        $this->assertEquals(['<title', '>', '管', '理', 'b', 'b', '</titl', 'e', '>'], $result);
    }

    public function testMultibyteCharacters()
    {
        $text = ['Hello ', '👋 ', '世界', '<MagicImage>cp_67b5aac969f26</MagicImage>', '🌍'];
        $result = [];
        $processor = new MagicStreamTextProcessor(function (string $data) use (&$result) {
            $result[] = $data;
        });
        $processor->start();
        foreach ($text as $current) {
            $processor->process($current);
        }
        $processor->end();
        $this->assertEquals([
            'Hello ',
            '👋 ',
            '世界',
            '<MagicImage>cp_67b5aac969f26</MagicImage>',
            '🌍',
        ], $result);
    }
}
