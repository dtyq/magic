<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'names' => [
        // Thao tác tệp
        'list_dir' => 'Liệt kê thư mục',
        'read_files' => 'Đọc nhiều tệp',
        'write_file' => 'Ghi tệp',
        'edit_file' => 'Chỉnh sửa tệp',
        'multi_edit_file' => 'Chỉnh sửa nhiều tệp',
        'delete_file' => 'Xóa tệp',
        'file_search' => 'Tìm kiếm tệp',
        'grep_search' => 'Tìm kiếm nội dung',

        // Tìm kiếm & Trích xuất
        'web_search' => 'Tìm kiếm web',
        'image_search' => 'Tìm kiếm hình ảnh',
        'read_webpages_as_markdown' => 'Trang web thành Markdown',
        'use_browser' => 'Thao tác trình duyệt',
        'download_from_urls' => 'Tải xuống hàng loạt',
        'download_from_markdown' => 'Tải xuống từ Markdown',

        // Xử lý nội dung
        'visual_understanding' => 'Hiểu hình ảnh',
        'convert_to_markdown' => 'Chuyển đổi sang Markdown',
        'voice_understanding' => 'Nhận dạng giọng nói',
        'summarize' => 'Tóm tắt',
        'generate_image' => 'Tạo hình ảnh thông minh',
        'create_slide' => 'Tạo slide',
        'create_slide_project' => 'Tạo dự án slide',
        'create_dashboard_project' => 'Tạo dashboard',
        'update_dashboard_template' => 'Cập nhật mẫu dashboard',
        'backup_dashboard_template' => 'Sao lưu mẫu dashboard',
        'finish_dashboard_task' => 'Hoàn thành tác vụ dashboard',

        // Thực thi hệ thống
        'shell_exec' => 'Thực thi lệnh',
        'python_execute' => 'Thực thi Python',

        // Hỗ trợ AI
        'create_memory' => 'Tạo bộ nhớ',
        'update_memory' => 'Cập nhật bộ nhớ',
        'delete_memory' => 'Xóa bộ nhớ',
        'finish_task' => 'Hoàn thành tác vụ',
        'compact_chat_history' => 'Nén lịch sử trò chuyện',
    ],

    'descriptions' => [
        // Thao tác tệp
        'list_dir' => 'Công cụ xem nội dung thư mục, hỗ trợ hiển thị đệ quy cấu trúc thư mục nhiều cấp, hiển thị kích thước tệp, số dòng và số token, giúp hiểu nhanh tổ chức tệp dự án và quy mô mã nguồn',
        'read_files' => 'Công cụ đọc tệp hàng loạt, đọc nội dung nhiều tệp cùng lúc, hỗ trợ văn bản, PDF, Word, Excel, CSV và nhiều định dạng khác, cải thiện đáng kể hiệu quả xử lý tác vụ nhiều tệp',
        'write_file' => 'Công cụ ghi tệp, ghi nội dung vào hệ thống tệp cục bộ, hỗ trợ tạo tệp mới hoặc ghi đè tệp hiện có, lưu ý giới hạn độ dài nội dung một lần, tệp lớn nên ghi theo từng bước',
        'edit_file' => 'Công cụ chỉnh sửa tệp chính xác, thực hiện thao tác thay thế chuỗi trên tệp hiện có, hỗ trợ xác thực khớp nghiêm ngặt và kiểm soát số lần thay thế, đảm bảo độ chính xác của thao tác chỉnh sửa',
        'multi_edit_file' => 'Công cụ chỉnh sửa tệp nhiều lần, thực hiện nhiều thao tác tìm-thay trong một tệp, tất cả chỉnh sửa được áp dụng theo thứ tự, hoặc tất cả thành công hoặc tất cả thất bại, đảm bảo tính nguyên tử của thao tác',
        'delete_file' => 'Công cụ xóa tệp, dùng để xóa tệp hoặc thư mục được chỉ định, chỉ có thể xóa tệp trong thư mục làm việc, vui lòng xác nhận đường dẫn tệp đúng trước khi thao tác',
        'file_search' => 'Công cụ tìm kiếm đường dẫn tệp, tìm kiếm nhanh dựa trên khớp mờ đường dẫn tệp, phù hợp cho các tình huống biết một phần đường dẫn tệp nhưng không chắc chắn vị trí cụ thể, trả về tối đa 10 kết quả',
        'grep_search' => 'Công cụ tìm kiếm nội dung tệp, sử dụng biểu thức chính quy để tìm kiếm các mẫu cụ thể trong nội dung tệp, hỗ trợ lọc loại tệp, hiển thị dòng khớp và ngữ cảnh, trả về tối đa 20 tệp liên quan',

        // Tìm kiếm & Trích xuất
        'web_search' => 'Công cụ tìm kiếm internet, hỗ trợ cấu hình định dạng XML để xử lý song song nhiều yêu cầu tìm kiếm, hỗ trợ tìm kiếm phân trang và lọc phạm vi thời gian, kết quả tìm kiếm bao gồm tiêu đề, URL, tóm tắt và trang web nguồn',
        'image_search' => 'Công cụ tìm kiếm hình ảnh, tìm kiếm và lọc thông minh hình ảnh chất lượng cao dựa trên từ khóa, hỗ trợ phân tích hiểu thị giác và lọc tỷ lệ khung hình, tự động loại bỏ trùng lặp đảm bảo chất lượng hình ảnh',
        'read_webpages_as_markdown' => 'Công cụ đọc trang web hàng loạt, tổng hợp nội dung nhiều trang web và chuyển đổi thành tài liệu Markdown duy nhất, hỗ trợ lấy nội dung đầy đủ và chế độ tóm tắt',
        'use_browser' => 'Công cụ tự động hóa trình duyệt, cung cấp khả năng thao tác trình duyệt nguyên tử, hỗ trợ điều hướng trang, tương tác phần tử, điền biểu mẫu và các thao tác mô-đun khác',
        'download_from_urls' => 'Công cụ tải xuống URL hàng loạt, hỗ trợ cấu hình XML cho nhiều tác vụ tải xuống, tự động xử lý chuyển hướng, tự động ghi đè nếu tệp đích đã tồn tại',
        'download_from_markdown' => 'Công cụ tải xuống tệp Markdown hàng loạt, trích xuất liên kết hình ảnh từ tệp Markdown và tải xuống hàng loạt, hỗ trợ URL mạng và sao chép tệp cục bộ',

        // Xử lý nội dung
        'visual_understanding' => 'Công cụ hiểu thị giác, phân tích và diễn giải nội dung hình ảnh, hỗ trợ JPEG, PNG, GIF và các định dạng khác, phù hợp cho mô tả nhận dạng hình ảnh, phân tích biểu đồ, trích xuất văn bản, so sánh nhiều hình ảnh và các tình huống khác',
        'convert_to_markdown' => 'Công cụ chuyển đổi định dạng tài liệu, chuyển đổi tài liệu sang định dạng Markdown và lưu trữ tại vị trí được chỉ định. Hỗ trợ nhiều loại tệp: PDF, Word, Excel, PowerPoint, hình ảnh, Jupyter notebooks, v.v',
        'voice_understanding' => 'Công cụ nhận dạng giọng nói, chuyển đổi tệp âm thanh thành văn bản, hỗ trợ wav, mp3, ogg, m4a và các định dạng khác, có thể bật chức năng nhận dạng thông tin người nói',
        'summarize' => 'Công cụ tinh chỉnh thông tin, nâng cao mật độ thông tin văn bản, loại bỏ nội dung dư thừa để làm cho nó có cấu trúc hơn, hỗ trợ yêu cầu tinh chỉnh tùy chỉnh và cài đặt độ dài mục tiêu',
        'generate_image' => 'Công cụ tạo và chỉnh sửa hình ảnh, hỗ trợ tạo hình ảnh mới từ mô tả văn bản và chỉnh sửa hình ảnh có sẵn. Có thể tùy chỉnh kích thước, số lượng hình ảnh và vị trí lưu trữ để đáp ứng các nhu cầu sáng tạo khác nhau',
        'create_slide' => 'Công cụ tạo slide, tạo slide HTML và thực thi phân tích JavaScript tùy chỉnh, hỗ trợ kiểm tra bố cục và xác thực ranh giới phần tử',
        'create_slide_project' => 'Công cụ tạo dự án slide, tự động tạo cấu trúc dự án hoàn chỉnh, bao gồm bộ điều khiển trình bày, tệp cấu hình, thư mục tài nguyên và script giao tiếp',
        'create_dashboard_project' => 'Công cụ tạo dự án dashboard dữ liệu, sao chép khung dashboard dữ liệu hoàn chỉnh từ thư mục mẫu, bao gồm HTML, CSS, JavaScript và các thành phần biểu đồ',
        'update_dashboard_template' => 'Công cụ cập nhật mẫu dashboard, đồng bộ các tệp dashboard.js, index.css, index.html và config.js từ thư mục mẫu đến dự án hiện có',
        'backup_dashboard_template' => 'Công cụ khôi phục sao lưu mẫu dashboard, khôi phục phiên bản sao lưu tệp mẫu cho dự án được chỉ định, thực hiện hoán đổi tệp hiện tại và tệp sao lưu',
        'finish_dashboard_task' => 'Công cụ hoàn thành dự án dashboard, tự động hóa hoàn thành cấu hình bản đồ và nguồn dữ liệu, bao gồm tải xuống GeoJSON, cập nhật cấu hình HTML và quét tệp dữ liệu',

        // Thực thi hệ thống
        'shell_exec' => 'Công cụ thực thi lệnh Shell, thực thi lệnh và script hệ thống, hỗ trợ cài đặt thời gian chờ và chỉ định thư mục làm việc, phù hợp cho thao tác tệp, quản lý tiến trình và các tình huống quản trị hệ thống khác',
        'python_execute' => 'Công cụ thực thi mã Python, chạy tệp script Python, hỗ trợ truyền tham số dòng lệnh, kiểm soát thời gian chờ và cài đặt thư mục làm việc, cần ghi mã vào tệp trước',

        // Hỗ trợ AI
        'create_memory' => 'Công cụ tạo bộ nhớ dài hạn, lưu trữ sở thích người dùng, thông tin dự án và các bộ nhớ quan trọng khác, hỗ trợ loại bộ nhớ người dùng và dự án, có thể thiết lập xem có cần xác nhận người dùng hay không',
        'update_memory' => 'Công cụ cập nhật bộ nhớ dài hạn, sửa đổi nội dung bộ nhớ hiện có hoặc thông tin thẻ, định vị và cập nhật bộ nhớ được chỉ định thông qua ID bộ nhớ',
        'delete_memory' => 'Công cụ xóa bộ nhớ dài hạn, loại bỏ hoàn toàn thông tin bộ nhớ không cần thiết thông qua ID bộ nhớ, dùng để dọn dẹp dữ liệu bộ nhớ lỗi thời hoặc sai',
        'finish_task' => 'Công cụ hoàn thành tác vụ, được gọi khi tất cả các tác vụ cần thiết đã hoàn thành, cung cấp phản hồi cuối cùng hoặc tạm dừng tác vụ để phản hồi người dùng, vào trạng thái dừng sau khi gọi',
        'compact_chat_history' => 'Công cụ nén lịch sử trò chuyện, được sử dụng để nén và tối ưu hóa lịch sử trò chuyện khi cuộc hội thoại trở nên quá dài, phân tích quá trình hội thoại và tạo tóm tắt để giảm độ dài ngữ cảnh và cải thiện hiệu quả hội thoại tiếp theo',
    ],
];
