<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\Compressible;

use App\Application\Flow\ExecuteManager\Compressible\CompressibleContent;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;
use Psr\SimpleCache\CacheInterface;

/**
 * @internal
 */
class CompressibleContentTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $content = '1.当我漫步在这园中，我才深刻体会到，每一处地方都曾留下我的足迹，而那些地方也都有过母亲的陪伴。<MagicCompressibleContent Type="Image">第一个需要被压缩的数据</MagicCompressibleContent> 2.若以一天喻四季，早晨是春天，中午是夏天，黄昏是秋天，夜晚则是冬天。\n!\n<MagicCompressibleContent Type="Video">第二个需要被压缩的数据</MagicCompressibleContent>3.太阳每时每刻都是落日与旭日，当他落山时，正是他爬上山头之时。而我，终将沉静地走下山去。';

        $compressibleContent = CompressibleContent::compress($content);
        $this->assertEquals($content, CompressibleContent::deCompress($compressibleContent));
    }

    public function testRun1()
    {
        $content = '1.当我漫步在这园中，我才深刻体会到，每一处地方都曾留下我的足迹，而那些地方也都有过母亲的陪伴。<MagicCompressibleContent Type="Image">第一个需要被压缩的数据</MagicCompressibleContent> 2.若以一天喻四季，早晨是春天，中午是夏天，黄昏是秋天，夜晚则是冬天。\n!\n<MagicCompressibleContent Type="Video">第二个需要被压缩的数据</MagicCompressibleContent>3.太阳每时每刻都是落日与旭日，当他落山时，正是他爬上山头之时。而我，终将沉静地走下山去。';

        $compressibleContent = CompressibleContent::compress($content);
        $this->assertEquals('1.当我漫步在这园中，我才深刻体会到，每一处地方都曾留下我的足迹，而那些地方也都有过母亲的陪伴。第一个需要被压缩的数据 2.若以一天喻四季，早晨是春天，中午是夏天，黄昏是秋天，夜晚则是冬天。\n!\n第二个需要被压缩的数据3.太阳每时每刻都是落日与旭日，当他落山时，正是他爬上山头之时。而我，终将沉静地走下山去。', CompressibleContent::deCompress($compressibleContent, false));
    }

    public function testRun2()
    {
        $content = '1.当我漫步在这园中，我才深刻体会到，每一处地方都曾留下我的足迹，而那些地方也都有过母亲的陪伴。<MAGIC-COMPRESSABLE-CONTENT TYPE="PICTURE">第一个需要被压缩的数据</MAGIC-COMPRESSABLE-CONTENT> 2.若以一天喻四季，早晨是春天，中午是夏天，黄昏是秋天，夜晚则是冬天。\n!\n<MAGIC-COMPRESSABLE-CONTENT TYPE="PICTURE">第二个需要被压缩的数据</MAGIC-COMPRESSABLE-CONTENT>3.太阳每时每刻都是落日与旭日，当他落山时，正是他爬上山头之时。而我，终将沉静地走下山去。';

        $compressibleContent = CompressibleContent::compress($content);
        $this->assertEquals($content, CompressibleContent::deCompress($compressibleContent));
    }

    public function testRun3()
    {
        $compressibleContent = '![向日葵下载](cp_678f7584c980a) ![图片](cp_678f7584c9801)';

        $id = 'compressible_content_cp_678f7584c980a';
        di(CacheInterface::class)->set($id, '压缩的链接1', 60);
        $id = 'compressible_content_cp_678f7584c9801';
        di(CacheInterface::class)->set($id, '压缩的链接2', 60);

        $this->assertEquals('![向日葵下载](压缩的链接1) ![图片](压缩的链接2)', CompressibleContent::deCompress($compressibleContent));
    }
}
