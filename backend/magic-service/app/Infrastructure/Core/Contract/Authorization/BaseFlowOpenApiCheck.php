<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Authorization;

use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Service\MagicFlowApiKeyDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Flow\DTO\MagicFlowApiChatDTO;
use Throwable;

class BaseFlowOpenApiCheck implements FlowOpenApiCheckInterface
{
    public function handle(MagicFlowApiChatDTO $magicFlowApiChatDTO): MagicUserAuthorization
    {
        $authOptions = $this->getAuthOptions($magicFlowApiChatDTO);

        try {
            return match ($authOptions['type']) {
                'api-key' => $this->apiKey($magicFlowApiChatDTO, $authOptions['authorization']),
                default => ExceptionBuilder::throw(FlowErrorCode::AccessDenied, 'error authorization type'),
            };
        } catch (Throwable $throwable) {
            ExceptionBuilder::throw(FlowErrorCode::AccessDenied, '登录异常', throwable: $throwable);
        }
    }

    /**
     * @return array{type: string, authorization: string}
     */
    protected function getAuthOptions(MagicFlowApiChatDTO $magicFlowApiChatDTO): array
    {
        $data = [
            'type' => '',
            'authorization' => '',
        ];
        if (! empty($magicFlowApiChatDTO->getApiKey())) {
            $data['type'] = 'api-key';
            $data['authorization'] = $magicFlowApiChatDTO->getApiKey();
            return $data;
        }
        $authorization = $magicFlowApiChatDTO->getAuthorization();
        if (str_starts_with($magicFlowApiChatDTO->getAuthorization(), 'Bearer ')) {
            $authorization = substr(trim($magicFlowApiChatDTO->getAuthorization()), 7);
        }
        // 还是 api-key
        if (str_starts_with($authorization, 'api-sk-')) {
            $data['type'] = 'api-key';
            $data['authorization'] = $authorization;
            return $data;
        }
        ExceptionBuilder::throw(FlowErrorCode::AccessDenied, 'error authorization');
    }

    protected function apiKey(MagicFlowApiChatDTO $magicFlowApiChatDTO, string $authorization): MagicUserAuthorization
    {
        $apiKey = di(MagicFlowApiKeyDomainService::class)->getBySecretKey(FlowDataIsolation::create()->disabled(), $authorization);
        $magicUserAuthorization = new MagicUserAuthorization();
        $magicUserAuthorization
            ->setId($apiKey->getCreator())
            ->setOrganizationCode($apiKey->getOrganizationCode())
            ->setUserType(UserType::Human)
            ->setMagicEnvId(0);
        if (empty($magicFlowApiChatDTO->getConversationId())) {
            $magicFlowApiChatDTO->setConversationId($apiKey->getConversationId());
        }
        $magicFlowApiChatDTO->setFlowCode($apiKey->getFlowCode());
        $user = di(MagicUserDomainService::class)->getByUserId($apiKey->getCreator());
        $magicFlowApiChatDTO->addShareOptions('user', $user);
        $magicFlowApiChatDTO->addShareOptions('source_id', SourceId::SK_FLOW);
        return $magicUserAuthorization;
    }
}
