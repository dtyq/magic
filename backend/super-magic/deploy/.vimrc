" ==================== 基础设置 ====================
" 显示行号
" set number

" 启用语法高亮
syntax on

" 设置编码
set encoding=utf-8
set fileencoding=utf-8

" 显示当前行高亮
" set cursorline

" 启用鼠标支持
set mouse=a

" ==================== 缩进设置 ====================
" 使用空格代替 Tab
set expandtab

" Tab 键显示为 4 个空格
set tabstop=4

" 自动缩进时使用 4 个空格
set shiftwidth=4

" 智能缩进
set smartindent
set autoindent

" ==================== 搜索设置 ====================
" 搜索时高亮显示
set hlsearch

" 增量搜索（边输入边搜索）
set incsearch

" 忽略大小写
set ignorecase

" 智能大小写（如果搜索词包含大写则区分大小写）
set smartcase

" ==================== 交换文件设置 ====================
" 将交换文件放到统一目录（避免污染工作目录）
set directory=~/.vim/swap//

" 创建备份文件目录
set backupdir=~/.vim/backup//

" 创建 undo 文件目录
set undodir=~/.vim/undo//

" 如果不想使用交换文件，可以取消下面的注释
" set noswapfile

" ==================== 其他实用设置 ====================
" 显示匹配的括号
set showmatch

" 显示命令
set showcmd

" 启用文件类型检测
filetype plugin indent on

" 不兼容 vi 模式
set nocompatible

" 自动读取外部修改
set autoread

" 显示状态栏
set laststatus=2

" 历史命令记录数
set history=1000

" 不产生备份文件
set nobackup
set nowritebackup
