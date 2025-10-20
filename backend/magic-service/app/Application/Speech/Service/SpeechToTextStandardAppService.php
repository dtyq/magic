<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use App\Domain\Speech\Entity\Dto\FlashSpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\LargeModelSpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\SpeechQueryDTO;
use App\Domain\Speech\Entity\Dto\SpeechSubmitDTO;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\SpeechRecognitionResultDTO;
use App\Infrastructure\ExternalAPI\Volcengine\SpeechRecognition\VolcengineStandardClient;
use DateTime;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class SpeechToTextStandardAppService
{
    protected LoggerInterface $logger;

    protected VolcengineStandardClient $volcengineClient;

    public function __construct(protected readonly AccessTokenDomainService $accessTokenDomainService)
    {
        $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get(self::class);
        $this->volcengineClient = new VolcengineStandardClient();
    }

    public function submitTask(SpeechSubmitDTO $submitDTO): array
    {
        $this->validateAccessToken($submitDTO->getAccessToken(), $submitDTO->getIps());
        //        $submitDTO->getAudio()->setUrl(SSRFUtil::getSafeUrl($submitDTO->getAudio()->getUrl(), replaceIp: false));
        return $this->volcengineClient->submitTask($submitDTO);
    }

    public function submitLargeModelTask(LargeModelSpeechSubmitDTO $submitDTO): array
    {
        $this->logger->info('Starting to submit large model speech recognition task', [
            'audio_url' => $submitDTO->getAudio()->getUrl(),
            'ips' => $submitDTO->getIps(),
        ]);

        $this->validateAccessToken($submitDTO->getAccessToken(), $submitDTO->getIps());

        /*$originalUrl = $submitDTO->getAudio()->getUrl();
        $safeUrl = SSRFUtil::getSafeUrl($originalUrl, replaceIp: false);
        $submitDTO->getAudio()->setUrl($safeUrl);*/

        $this->logger->info('Calling Volcengine BigModel speech recognition API');
        $result = $this->volcengineClient->submitBigModelTask($submitDTO);

        $this->logger->info('Large model speech recognition task submitted successfully', [
            'task_id' => $result['task_id'] ?? null,
        ]);

        return $result;
    }

    public function queryResult(SpeechQueryDTO $queryDTO): array
    {
        $this->validateAccessToken($queryDTO->getAccessToken(), $queryDTO->getIps());
        return $this->volcengineClient->queryResult($queryDTO);
    }

    /**
     * 查询大模型语音识别结果.
     */
    public function queryLargeModelResult(SpeechQueryDTO $speechQueryDTO): SpeechRecognitionResultDTO
    {
        $this->validateAccessToken($speechQueryDTO->getAccessToken(), []);
        return $this->volcengineClient->queryBigModelResult($speechQueryDTO->getTaskId());
    }

    public function submitFlashTask(FlashSpeechSubmitDTO $submitDTO): array
    {
        $this->validateAccessToken($submitDTO->getAccessToken(), $submitDTO->getIps());
        //        $submitDTO->getAudio()->setUrl(SSRFUtil::getSafeUrl($submitDTO->getAudio()->getUrl(), replaceIp: false));
        return $this->volcengineClient->submitFlashTask($submitDTO)->getResponseData();
    }

    private function validateAccessToken(string $accessToken, array $clientIps): AccessTokenEntity
    {
        $accessTokenEntity = $this->accessTokenDomainService->getByAccessToken($accessToken);
        if (! $accessTokenEntity) {
            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_NOT_EXIST);
        }

        $accessTokenEntity->checkIps($clientIps);
        $accessTokenEntity->checkExpiredTime(new DateTime());

        return $accessTokenEntity;
    }
}
