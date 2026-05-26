<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Facade\Open;

use App\Application\ModelGateway\Service\DataQueryAppService;
use App\Interfaces\ModelGateway\Request\WeatherForecastRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class DataQueryApi extends AbstractOpenApi
{
    #[Inject]
    protected DataQueryAppService $dataQueryAppService;

    /**
     * Weather forecast endpoint.
     *
     * GET /api/v1/open-api/weather/forecast
     *
     * Query Parameters:
     * - location: City, address, or 'lat,lng' (required)
     * - days: Forecast days 1-7 (optional, default: 3)
     * - language: 'zh' or 'en' (optional, default: 'zh')
     * - provider: Weather driver name (optional, uses default from config)
     */
    public function weatherForecast(WeatherForecastRequest $request): array
    {
        $request->validateResolved();
        $location = $request->input('location');
        $days = (int) $request->input('days', 3);
        $language = $request->input('language', 'zh');
        $provider = $request->input('provider');

        return $this->dataQueryAppService->weatherForecast($location, $days, $language, $provider);
    }
}
