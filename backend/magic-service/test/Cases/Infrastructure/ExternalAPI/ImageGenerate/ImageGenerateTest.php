<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Flux\FluxModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\GPT\GPT4oModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Midjourney\MidjourneyModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision\MiracleVisionModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Volcengine\VolcengineModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\FluxModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\GPT4oModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\MidjourneyModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\MiracleVisionModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\VolcengineModelRequest;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class ImageGenerateTest extends BaseTest
{


    public static function isBase64Image(string $str): bool
    {
        $data = explode(',', $str);
        if (count($data) !== 2) {
            return false;
        }
        $header = $data[0];
        $imageData = $data[1];
        // 检查头部是否符合Base64编码图片的格式
        if (! preg_match('/^data:image\/(png|jpeg|jpg|gif);base64$/', $header)) {
            return false;
        }
        // 检查Base64编码是否有效
        $decodedData = base64_decode($imageData);
        return $decodedData !== false;
    }

    public function testBase64Image()
    {
        $base64 = 'xx';
        $uploadDir = 'DT001' . '/open/' . md5(StorageBucketType::Public->value);
        $uploadFile = new UploadFile($base64, $uploadDir, 'test');

            $fileDomainService = di(FileDomainService::class);
            // 上传文件（指定不自动创建目录）
            $fileDomainService->uploadByCredential('DT001', $uploadFile);

            // 生成可访问的链接
            $fileLink = $fileDomainService->getLink('DT001', $uploadFile->getKey(), StorageBucketType::Private);
            var_dump($fileLink);
    }

    // 转超清
    public function testImage2ImagePlus()
    {
        //        $this->markTestSkipped();

        // 测试需要跳过
        $url = 'https://p9-aiop-sign.byteimg.com/tos-cn-i-vuqhorh59i/2025012317440606999C578B9234E9F5A4-0~tplv-vuqhorh59i-image.image?rk3s=7f9e702d&x-expires=1737711846&x-signature=5bkTf2E2xzRQVsDhrZZYghlJsUw%3D';
        $MiracleVisionModelRequest = new MiracleVisionModelRequest($url);
        $MiracleVisionModel = new MiracleVisionModel();
        $taskId = $MiracleVisionModel->imageConvertHigh($MiracleVisionModelRequest);
        $miracleVisionModelResponse = $MiracleVisionModel->queryTask($taskId);
        $index = 0;
        while (true) {
            if ($index > 60) {
                break;
            }
            if ($miracleVisionModelResponse->isFinishStatus()) {
                var_dump($miracleVisionModelResponse->getUrls());
                break;
            }
            ++$index;
            sleep(2);
        }
        $this->markTestSkipped();
    }

    public function testText2ImageByVolcengine()
    {
        $volcengineModelRequest = new VolcengineModelRequest();
        $volcengineModelRequest->setPrompt('摄影作品，真人写真风格，一个画着万圣节装扮的女人手里拿着一个南瓜灯，该设计冷色调与暖色调结合，冷色调与暖色调过渡自然，色调柔和，电影感，电影海报，高级感，16k，超详细，UHD');
        $volcengineModelRequest->setGenerateNum(1);
        $volcengineModelRequest->setWidth('1024');
        $volcengineModelRequest->setHeight('1024');
        $volcengineModel = new VolcengineModel();
        $result = $volcengineModel->generateImage($volcengineModelRequest);
        var_dump($result);
        $this->markTestSkipped();
    }

    public function testText2ImageByFluix()
    {
        $FluxModelRequest = new FluxModelRequest();
        $FluxModelRequest->setPrompt('摄影作品，真人写真风格，一个画着万圣节装扮的女人手里拿着一个南瓜灯，该设计冷色调与暖色调结合，冷色调与暖色调过渡自然，色调柔和，电影感，电影海报，高级感，16k，超详细，UHD');
        $FluxModelRequest->setGenerateNum(1);
        $FluxModelRequest->setWidth('1024');
        $FluxModelRequest->setHeight('1024');
        $FluxModel = new FluxModel();
        $result = $FluxModel->generateImage($FluxModelRequest);
        var_dump($result);
        $this->markTestSkipped();
    }

    public function testText2ImageByMJ()
    {
        $MjModelRequest = new MidjourneyModelRequest();
        $MjModelRequest->setPrompt('摄影作品，真人写真风格，一个画着万圣节装扮的女人手里拿着一个南瓜灯，该设计冷色调与暖色调结合，冷色调与暖色调过渡自然，色调柔和，电影感，电影海报，高级感，16k，超详细，UHD');
        $MjModelRequest->setGenerateNum(1);
        $MjModelRequest->setModel('relax');
        $MjModel = new MidjourneyModel();
        $result = $MjModel->generateImage($MjModelRequest);
        var_dump($result);
        $this->markTestSkipped();
    }

    public function testText2ImageByGPT4o()
    {
        // 创建GPT4o模型实例
        $gpt4oModel = new GPT4oModel();

        // 创建请求实例
        $gpt4oModelRequest = new GPT4oModelRequest();
        $gpt4oModelRequest->setPrompt('一只小金毛正在草原上欢快的奔跑');
        $gpt4oModelRequest->setGenerateNum(4);

        // 生成图片
        $result = $gpt4oModel->generateImage($gpt4oModelRequest);

        // 验证结果
        $this->assertNotEmpty($result);
        $this->assertEquals(ImageGenerateType::URL, $result->getImageGenerateType());
        $urls = $result->getData();
        $this->assertIsArray($urls);
        $this->assertCount(1, $urls);
        $this->assertNotEmpty($urls[0]);
        $this->assertStringStartsWith('http', $urls[0]);

        var_dump($result);
        $this->markTestSkipped();
    }

    public function testText2ImageByGPT4oWithReferenceImages()
    {
        // 创建GPT4o模型实例
        $gpt4oModel = new GPT4oModel();

        // 创建请求实例
        $gpt4oModelRequest = new GPT4oModelRequest();
        $gpt4oModelRequest->setPrompt('调整一群女巫手里捧着南瓜在膜拜一个人');
        $gpt4oModelRequest->setGenerateNum(1);

        // 设置参考图片
        $gpt4oModelRequest->setReferImages([
            'https://cdn.ttapi.io/gpt/2025-04-01/0a4f0c65-c678-4e4d-a26c-ee7c50398f3f.png',
        ]);

        // 生成图片
        $result = $gpt4oModel->generateImage($gpt4oModelRequest);

        // 验证结果
        $this->assertNotEmpty($result);
        $this->assertEquals(ImageGenerateType::URL, $result->getImageGenerateType());
        $urls = $result->getData();
        $this->assertIsArray($urls);
        $this->assertCount(1, $urls);
        $this->assertNotEmpty($urls[0]);
        $this->assertStringStartsWith('http', $urls[0]);

        var_dump($result);
        $this->markTestSkipped();
    }


    
    /**
     * Check if binary data is valid image data by examining magic bytes
     */
    private static function isValidImageData(string $data): bool
    {
        if (strlen($data) < 8) {
            return false;
        }
        
        // Check for common image format signatures
        $signatures = [
            // PNG
            "\x89\x50\x4E\x47\x0D\x0A\x1A\x0A",
            // JPEG
            "\xFF\xD8\xFF",
            // GIF87a
            "\x47\x49\x46\x38\x37\x61",
            // GIF89a  
            "\x47\x49\x46\x38\x39\x61",
            // BMP
            "\x42\x4D",
            // WebP
            "\x52\x49\x46\x46",
        ];
        
        foreach ($signatures as $signature) {
            if (strpos($data, $signature) === 0) {
                return true;
            }
        }
        
        // For WebP, we need additional check
        if (strpos($data, "\x52\x49\x46\x46") === 0 && strpos($data, "\x57\x45\x42\x50") === 8) {
            return true;
        }
        
        return false;
    }
}
