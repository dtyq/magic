"""
Message Schedule API

API implementation for message schedule (cron task) operations in Magic Service.
"""

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..parameter.message_schedule_parameter import (
    MessageScheduleParameter,
    QueryMessageSchedulesParameter,
    GetMessageScheduleDetailParameter,
    UpdateMessageScheduleParameter,
    DeleteMessageScheduleParameter,
)
from ..result.message_schedule_result import (
    MessageScheduleResult,
    MessageScheduleListResult,
    DeleteMessageScheduleResult,
)

# 定时任务相关接口的基础路径
_SCHEDULE_BASE_PATH = '/api/v1/open-api/super-magic/message-schedule'


class MessageScheduleApi(MagicServiceAbstractApi):
    """定时消息任务 API"""

    def create_message_schedule(
        self,
        parameter: MessageScheduleParameter
    ) -> MessageScheduleResult:
        """
        创建定时消息任务

        Args:
            parameter: MessageScheduleParameter 请求参数

        Returns:
            MessageScheduleResult 包含创建结果
        """
        data = self.request_by_parameter(parameter, 'POST', _SCHEDULE_BASE_PATH)
        return MessageScheduleResult(data)

    async def create_message_schedule_async(
        self,
        parameter: MessageScheduleParameter
    ) -> MessageScheduleResult:
        """
        创建定时消息任务（异步版本）

        Args:
            parameter: MessageScheduleParameter 请求参数

        Returns:
            MessageScheduleResult 包含创建结果
        """
        data = await self.request_by_parameter_async(parameter, 'POST', _SCHEDULE_BASE_PATH)
        return MessageScheduleResult(data)

    def query_message_schedules(
        self,
        parameter: QueryMessageSchedulesParameter
    ) -> MessageScheduleListResult:
        """
        查询定时消息任务列表

        Args:
            parameter: QueryMessageSchedulesParameter 请求参数

        Returns:
            MessageScheduleListResult 包含分页列表结果
        """
        path = f'{_SCHEDULE_BASE_PATH}/queries'
        data = self.request_by_parameter(parameter, 'GET', path)
        return MessageScheduleListResult(data)

    async def query_message_schedules_async(
        self,
        parameter: QueryMessageSchedulesParameter
    ) -> MessageScheduleListResult:
        """
        查询定时消息任务列表（异步版本）

        Args:
            parameter: QueryMessageSchedulesParameter 请求参数

        Returns:
            MessageScheduleListResult 包含分页列表结果
        """
        path = f'{_SCHEDULE_BASE_PATH}/queries'
        data = await self.request_by_parameter_async(parameter, 'GET', path)
        return MessageScheduleListResult(data)

    def get_message_schedule_detail(
        self,
        parameter: GetMessageScheduleDetailParameter
    ) -> MessageScheduleResult:
        """
        获取定时消息任务详情

        Args:
            parameter: GetMessageScheduleDetailParameter 请求参数

        Returns:
            MessageScheduleResult 包含任务详情
        """
        path = f'{_SCHEDULE_BASE_PATH}/{parameter.get_schedule_id()}'
        data = self.request_by_parameter(parameter, 'GET', path)
        return MessageScheduleResult(data)

    async def get_message_schedule_detail_async(
        self,
        parameter: GetMessageScheduleDetailParameter
    ) -> MessageScheduleResult:
        """
        获取定时消息任务详情（异步版本）

        Args:
            parameter: GetMessageScheduleDetailParameter 请求参数

        Returns:
            MessageScheduleResult 包含任务详情
        """
        path = f'{_SCHEDULE_BASE_PATH}/{parameter.get_schedule_id()}'
        data = await self.request_by_parameter_async(parameter, 'GET', path)
        return MessageScheduleResult(data)

    def update_message_schedule(
        self,
        parameter: UpdateMessageScheduleParameter
    ) -> MessageScheduleResult:
        """
        更新定时消息任务

        Args:
            parameter: UpdateMessageScheduleParameter 请求参数

        Returns:
            MessageScheduleResult 包含更新后的任务信息
        """
        path = f'{_SCHEDULE_BASE_PATH}/{parameter.get_schedule_id()}'
        data = self.request_by_parameter(parameter, 'PUT', path)
        return MessageScheduleResult(data)

    async def update_message_schedule_async(
        self,
        parameter: UpdateMessageScheduleParameter
    ) -> MessageScheduleResult:
        """
        更新定时消息任务（异步版本）

        Args:
            parameter: UpdateMessageScheduleParameter 请求参数

        Returns:
            MessageScheduleResult 包含更新后的任务信息
        """
        path = f'{_SCHEDULE_BASE_PATH}/{parameter.get_schedule_id()}'
        data = await self.request_by_parameter_async(parameter, 'PUT', path)
        return MessageScheduleResult(data)

    def delete_message_schedule(
        self,
        parameter: DeleteMessageScheduleParameter
    ) -> DeleteMessageScheduleResult:
        """
        删除定时消息任务

        Args:
            parameter: DeleteMessageScheduleParameter 请求参数

        Returns:
            DeleteMessageScheduleResult 包含删除结果
        """
        path = f'{_SCHEDULE_BASE_PATH}/{parameter.get_schedule_id()}'
        data = self.request_by_parameter(parameter, 'DELETE', path)
        return DeleteMessageScheduleResult(data)

    async def delete_message_schedule_async(
        self,
        parameter: DeleteMessageScheduleParameter
    ) -> DeleteMessageScheduleResult:
        """
        删除定时消息任务（异步版本）

        Args:
            parameter: DeleteMessageScheduleParameter 请求参数

        Returns:
            DeleteMessageScheduleResult 包含删除结果
        """
        path = f'{_SCHEDULE_BASE_PATH}/{parameter.get_schedule_id()}'
        data = await self.request_by_parameter_async(parameter, 'DELETE', path)
        return DeleteMessageScheduleResult(data)
