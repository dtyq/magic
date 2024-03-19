"""
并行执行异步任务的工具类，提供类似 Golang 的并发模型

使用示例:
    # 创建 Parallel 实例
    parallel = Parallel()
    
    # 添加异步任务
    parallel.add(async_function1, arg1, arg2, kwarg1=value1)
    parallel.add(async_function2)
    
    # 运行所有任务并等待结果
    results = await parallel.run()
    
    # 也可以分开执行和等待
    parallel.start()
    # 做其他事情...
    results = await parallel.wait()
"""

import asyncio
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple, TypeVar, Union, cast

T = TypeVar('T')
TaskFunc = Callable[..., Awaitable[T]]
TaskItem = Tuple[TaskFunc, Tuple[Any, ...], Dict[str, Any]]
TaskResult = Tuple[int, Union[T, Exception]]

class Parallel:
    """
    并行执行异步任务的工具类，提供类似 Golang 的并发模型
    
    支持添加多个异步任务，并发执行它们，然后等待所有任务完成并获取结果
    """
    
    def __init__(self, timeout: Optional[float] = None):
        """
        初始化并行执行器
        
        Args:
            timeout: 全局任务超时时间（秒），None 表示不设置超时
        """
        self._tasks: List[TaskItem] = []
        self._running_tasks: List[asyncio.Task] = []
        self._timeout = timeout
        self._started = False
    
    def add(self, func: TaskFunc, *args: Any, **kwargs: Any) -> 'Parallel':
        """
        添加一个异步任务
        
        Args:
            func: 异步函数
            args: 位置参数
            kwargs: 关键字参数
            
        Returns:
            self，支持链式调用
        
        Raises:
            RuntimeError: 如果尝试在已经启动后添加任务
        """
        if self._started:
            raise RuntimeError("Cannot add tasks after starting")
        
        self._tasks.append((func, args, kwargs))
        return self
    
    async def _execute_task(self, index: int, func: TaskFunc, args: Tuple[Any, ...], 
                            kwargs: Dict[str, Any]) -> TaskResult:
        """
        执行单个任务并捕获异常
        
        Args:
            index: 任务索引
            func: 异步函数
            args: 位置参数
            kwargs: 关键字参数
            
        Returns:
            (任务索引, 结果或异常)的元组
        """
        try:
            result = await func(*args, **kwargs)
            return index, result
        except Exception as e:
            return index, e
    
    def start(self) -> None:
        """
        启动所有任务的执行，但不等待结果
        
        Raises:
            RuntimeError: 如果任务已经启动
        """
        if self._started:
            raise RuntimeError("Tasks already started")
        
        self._started = True
        
        for i, (func, args, kwargs) in enumerate(self._tasks):
            task = asyncio.create_task(self._execute_task(i, func, args, kwargs))
            self._running_tasks.append(task)
    
    async def wait(self) -> List[Union[Any, Exception]]:
        """
        等待所有任务完成并返回结果
        
        如果任务还未启动，会自动启动任务
        
        Returns:
            与添加任务相同顺序的结果列表，如果任务失败则对应位置为异常对象
            
        Raises:
            asyncio.TimeoutError: 如果设置了超时且任务执行超时
        """
        if not self._started:
            self.start()
        
        results_with_index: List[TaskResult] = []
        
        try:
            # 等待所有任务完成或超时
            done, pending = await asyncio.wait(
                self._running_tasks, 
                timeout=self._timeout,
                return_when=asyncio.ALL_COMPLETED
            )
            
            # 如果有未完成的任务，则超时
            if pending:
                # 取消所有未完成的任务
                for task in pending:
                    task.cancel()
                
                # 等待取消操作完成
                await asyncio.gather(*pending, return_exceptions=True)
                raise asyncio.TimeoutError(f"{len(pending)} tasks did not complete within the timeout")
            
            # 收集结果
            for task in done:
                results_with_index.append(task.result())
                
        finally:
            # 重置状态，允许再次运行
            self._started = False
            self._running_tasks = []
        
        # 按原始顺序整理结果
        results_with_index.sort(key=lambda x: x[0])
        return [result for _, result in results_with_index]
    
    async def run(self) -> List[Union[Any, Exception]]:
        """
        启动所有任务并等待它们完成，返回结果
        
        这是 start() 和 wait() 的组合快捷方法
        
        Returns:
            与添加任务相同顺序的结果列表，如果任务失败则对应位置为异常对象
            
        Raises:
            asyncio.TimeoutError: 如果设置了超时且任务执行超时
        """
        self.start()
        return await self.wait()
    
    @staticmethod
    async def execute(funcs: List[TaskFunc], *args_list: List[Any], 
                     timeout: Optional[float] = None, **kwargs_list: Dict[str, Any]) -> List[Any]:
        """
        静态便捷方法，执行多个相同参数的异步函数
        
        Args:
            funcs: 异步函数列表
            args_list: 每个函数的位置参数列表的列表
            timeout: 超时时间（秒）
            kwargs_list: 每个函数的关键字参数字典的列表
            
        Returns:
            结果列表
            
        Raises:
            asyncio.TimeoutError: 如果设置了超时且任务执行超时
        """
        parallel = Parallel(timeout=timeout)
        
        # 如果提供了多组参数
        if args_list and isinstance(args_list[0], list):
            # 检查参数数量是否匹配
            if len(args_list) != len(funcs):
                raise ValueError("Number of argument lists must match number of functions")
            
            for i, func in enumerate(funcs):
                parallel.add(func, *args_list[i])
        else:
            # 对所有函数使用相同的参数
            common_args = args_list
            for func in funcs:
                parallel.add(func, *common_args)
        
        return await parallel.run() 