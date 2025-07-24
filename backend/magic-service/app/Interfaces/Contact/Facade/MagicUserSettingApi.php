<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Contact\Facade;

use App\Application\Contact\Service\MagicUserSettingAppService;
use App\Domain\Contact\Entity\ValueObject\Query\MagicUserSettingQuery;
use App\Infrastructure\Core\AbstractApi;
use App\Interfaces\Contact\Assembler\MagicUserSettingAssembler;
use App\Interfaces\Contact\DTO\MagicUserSettingDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class MagicUserSettingApi extends AbstractApi
{
    #[Inject]
    protected MagicUserSettingAppService $magicUserSettingAppService;

    public function save()
    {
        $authorization = $this->getAuthorization();

        $dto = new MagicUserSettingDTO($this->request->all());
        $entity = MagicUserSettingAssembler::createEntity($dto);

        $savedEntity = $this->magicUserSettingAppService->save($authorization, $entity);

        return MagicUserSettingAssembler::createDTO($savedEntity);
    }

    public function get(string $key)
    {
        $authorization = $this->getAuthorization();

        $entity = $this->magicUserSettingAppService->get($authorization, $key);

        if (! $entity) {
            return null;
        }

        return MagicUserSettingAssembler::createDTO($entity);
    }

    public function queries()
    {
        $authorization = $this->getAuthorization();
        $page = $this->createPage();

        $query = new MagicUserSettingQuery($this->request->all());

        $result = $this->magicUserSettingAppService->queries($authorization, $query, $page);

        return MagicUserSettingAssembler::createPageListDTO(
            total: $result['total'],
            list: $result['list'],
            page: $page
        );
    }

    public function saveProjectTopicModelConfig(string $topicId)
    {
        $authorization = $this->getAuthorization();
        $model = $this->request->input('model', []);

        $userSetting = $this->magicUserSettingAppService->saveProjectTopicModelConfig($authorization, $topicId, $model);
        return $userSetting->getValue();
    }

    public function getProjectTopicModelConfig(string $topicId)
    {
        $authorization = $this->getAuthorization();
        $userSetting = $this->magicUserSettingAppService->getProjectTopicModelConfig($authorization, $topicId);
        return $userSetting?->getValue() ?? [];
    }
}
