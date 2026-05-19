# -*- mode: python ; coding: utf-8 -*-
import os
import glob
import sysconfig

from PyInstaller.utils.hooks import copy_metadata, collect_all

# 加密？
block_cipher = None

# 一些需要额外处理的模块
extra_binaries = []
extra_datas = []
extra_hiddenimports = []
for module in (
    'magika',
    'pydantic_core',
    'charset_normalizer',  # 含 mypyc 编译的 .so 扩展，需显式收录
    'PIL',  # Pillow 图片处理库（导入名是 PIL，不是包名 pillow）
    'pillow_heif',  # AVIF/HEIC/HEIF 格式支持
):
    all_dependencies = collect_all(module)
    extra_binaries.extend(all_dependencies[1])
    extra_datas.extend(all_dependencies[0])
    extra_hiddenimports.extend(all_dependencies[2])

# charset_normalizer 的 mypyc 共享库（如 81d243bd2c585b0f4821__mypyc.so）安装在
# site-packages 根目录，collect_all 扫不到。必须手动收录并放到 bundle 根目录('.')，
# 否则运行时 `import 81d243bd2c585b0f4821__mypyc` 这类顶层导入会 ModuleNotFoundError。
_site_packages = sysconfig.get_path('purelib')
for _so in glob.glob(os.path.join(_site_packages, '*__mypyc*.so')):
    extra_binaries.append((_so, '.'))

# C extensions
c_extension_binaries = []
c_modules = ['_contextvars', '_asyncio', '_decimal', '_queue', '_hashlib', '_ssl', '_lzma', '_bz2']

for module in c_modules:
    pattern = os.path.join(f"{sysconfig.get_path('stdlib')}/lib-dynload", f"{module}*.so")
    for so_file in glob.glob(pattern):
        c_extension_binaries.append((so_file, '.'))

a = Analysis(
    ['main.py'],
    pathex=['.'],  # 只保留当前目录，因为 -e 安装应使包可导入
    binaries=[
        *c_extension_binaries,
        *extra_binaries,
        # ("/venv/lib/python3.13/site-packages/pydantic_core/_pydantic_core.cpython-313-x86_64-linux-gnu.so", "pydantic_core"),
    ],
    datas=[
        *extra_datas,
        ('.super-magic-project-root', '.'),  # 项目根目录标志文件，供 skill 脚本定位根目录
        ('agents', 'agents'),  # 添加agents目录
        ('config', 'config'),  # 添加config目录
        ('static', 'static'),
        # 添加SDK目录作为数据文件（不加密，保持源代码可读）
        ('sdk', 'sdk'),
        # 添加幻灯片模板文件
        ('app/tools/magic_slide', 'app/tools/magic_slide'),
        # 添加音频项目模板文件
        ('app/tools/magic_audio', 'app/tools/magic_audio'),
        # 添加视频项目模板文件
        ('app/tools/magic_video', 'app/tools/magic_video'),
        # 添加设计项目模板文件
        ('app/tools/magic_design', 'app/tools/magic_design'),
        # 添加数据分析模板
        ('app/tools/data_analyst_dashboard_template', 'app/tools/data_analyst_dashboard_template'),
        # 添加所有js文件
        ('magic_use/js', 'magic_use/js'),
        ('app/i18n/translations', 'app/i18n/translations'),
        ('magic_use/magic_monkey', 'magic_use/magic_monkey'),
        # 添加需要被动态加载的组件包的元数据，使得 importlib.metadata.entry_points 可以发现工具包
    ],
    # 需要被动态加载的隐性组件包
    hiddenimports=[
        *extra_hiddenimports,
        # 使得包可以被动态 import 进来
        'pydantic',
        'pydantic_core',
        'pydantic_core._pydantic_core',
        # PIL/Pillow 相关模块
        'PIL',
        'PIL.Image',
        'PIL.ImageFile',
        'PIL.ImageSequence',
        'PIL._imaging',
        # pillow-heif 依赖
        'pillow_heif',
        'pillow_heif.as_plugin',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=['hooks/runtime_hook_sdk.py'],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# 这里过滤掉不需要的文件
def exclude_files(file_list):
    return [x for x in file_list if not (
        # 排除虚拟环境
        x[0].startswith('.venv') or
        x[0].startswith('venv') or
        x[0].startswith('env') or
        # 排除缓存文件
        '__pycache__' in x[0] or
        '.pyc' in x[0] or
        # 排除测试文件
        '/tests/' in x[0] or
        '/test_' in x[0] or
        # 排除git相关
        '.git/' in x[0]
    )]

# 应用过滤器
a.binaries = exclude_files(a.binaries)
a.datas = exclude_files(a.datas)

# 从加密列表中排除 sdk 模块（因为已作为数据文件添加，保持源代码不加密）
def exclude_sdk_modules(pure_list):
    """从 pure 列表中排除根目录的 sdk 模块，避免重复且保持不加密

    注意：只排除根目录的 sdk 模块（如 sdk.mcp），不排除其他包中的 sdk 子模块
    """
    return [x for x in pure_list if not (
        x[0].startswith('sdk.') or x[0] == 'sdk'  # 只排除根目录的 sdk 模块
    )]

a.pure = exclude_sdk_modules(a.pure)

# 创建第二个分析对象用于 script_runner（轻量级 Python 运行器）
# 注意：runner_a 只用于生成 scripts，实际的 Python 包会使用 main 的 a.pure
runner_a = Analysis(
    ['script_runner.py'],
    pathex=['.'],
    binaries=[],
    datas=[],  # 不需要任何数据文件
    hiddenimports=[],  # 不需要指定，因为会使用 main 的 a.pure
    hookspath=[],
    hooksconfig={},
    runtime_hooks=['hooks/runtime_hook_sdk.py'],  # 使用相同的 runtime hook
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# 主应用的 PYZ 和 EXE
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='main',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    contents_directory='.',
)

# script_runner 的 PYZ 和 EXE
# 使用 main 的 a.pure 和 a.zipped_data，确保 script_runner 可以访问所有项目依赖
runner_pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

runner_exe = EXE(
    runner_pyz,
    runner_a.scripts,
    [],
    exclude_binaries=True,
    name='script_runner',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    contents_directory='.',
)

# 收集所有文件（包含两个可执行文件）
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    runner_exe,  # 添加 script_runner 可执行文件
    runner_a.binaries,  # 添加 script_runner 的二进制文件
    strip=False,
    upx=True,
    upx_exclude=[],
    name='main',
)
