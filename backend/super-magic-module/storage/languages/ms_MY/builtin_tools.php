<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'names' => [
        // Operasi Fail
        'list_dir' => 'Senarai Direktori',
        'read_files' => 'Baca Berbilang Fail',
        'write_file' => 'Tulis Fail',
        'edit_file' => 'Edit Fail',
        'multi_edit_file' => 'Edit Berbilang Fail',
        'delete_file' => 'Padam Fail',
        'file_search' => 'Cari Fail',
        'grep_search' => 'Cari Kandungan',

        // Carian & Pengekstrakan
        'web_search' => 'Carian Web',
        'image_search' => 'Carian Imej',
        'read_webpages_as_markdown' => 'Laman Web ke Markdown',
        'use_browser' => 'Operasi Pelayar',
        'download_from_urls' => 'Muat Turun Berkelompok',
        'download_from_markdown' => 'Muat Turun dari Markdown',

        // Pemprosesan Kandungan
        'visual_understanding' => 'Pemahaman Visual',
        'convert_pdf' => 'Tukar PDF',
        'voice_understanding' => 'Pengecaman Suara',
        'summarize' => 'Ringkasan',
        'text_to_image' => 'Teks ke Imej',
        'image_edit' => 'Edit Imej',
        'create_slide' => 'Cipta Slaid',
        'create_slide_project' => 'Cipta Projek Slaid',
        'create_dashboard_project' => 'Cipta Dashboard',
        'update_dashboard_template' => 'Kemas Kini Template Dashboard',
        'backup_dashboard_template' => 'Sandaran Template Dashboard',
        'finish_dashboard_task' => 'Selesaikan Tugas Dashboard',

        // Pelaksanaan Sistem
        'shell_exec' => 'Laksana Arahan',
        'python_execute' => 'Laksana Python',

        // Bantuan AI
        'create_memory' => 'Cipta Memori',
        'update_memory' => 'Kemas Kini Memori',
        'delete_memory' => 'Padam Memori',
        'finish_task' => 'Selesaikan Tugas',
    ],

    'descriptions' => [
        // Operasi Fail
        'list_dir' => 'Alat melihat kandungan direktori, menyokong paparan rekursif struktur direktori berbilang peringkat, menunjukkan saiz fail, kiraan baris dan kiraan token, membantu memahami organisasi fail projek dan skala kod dengan cepat',
        'read_files' => 'Alat membaca fail berkelompok, membaca kandungan berbilang fail sekaligus, menyokong teks, PDF, Word, Excel, CSV dan format lain, meningkatkan kecekapan pemprosesan tugas berbilang fail dengan ketara',
        'write_file' => 'Alat menulis fail, menulis kandungan ke sistem fail tempatan, menyokong mencipta fail baharu atau mengganti fail sedia ada, perhatikan had panjang kandungan sekali, fail besar disyorkan ditulis secara berperingkat',
        'edit_file' => 'Alat penyuntingan fail tepat, melakukan operasi penggantian rentetan pada fail sedia ada, menyokong pengesahan pemadanan ketat dan kawalan kiraan penggantian, memastikan ketepatan operasi penyuntingan',
        'multi_edit_file' => 'Alat penyuntingan fail berbilang, melakukan berbilang operasi cari-ganti dalam satu fail, semua suntingan digunakan mengikut urutan, sama ada semua berjaya atau semua gagal, memastikan atomisiti operasi',
        'delete_file' => 'Alat pemadaman fail, digunakan untuk memadam fail atau direktori yang ditentukan, hanya boleh memadam fail dalam direktori kerja, sila sahkan laluan fail adalah betul sebelum operasi',
        'file_search' => 'Alat carian laluan fail, carian pantas berdasarkan pemadanan kabur laluan fail, sesuai untuk senario di mana sebahagian laluan fail diketahui tetapi lokasi khusus tidak pasti, mengembalikan sehingga 10 hasil',
        'grep_search' => 'Alat carian kandungan fail, menggunakan ungkapan biasa untuk mencari corak khusus dalam kandungan fail, menyokong penapisan jenis fail, memaparkan baris padanan dan konteks, mengembalikan sehingga 20 fail berkaitan',

        // Carian & Pengekstrakan
        'web_search' => 'Alat carian internet, menyokong konfigurasi format XML untuk pemprosesan selari berbilang permintaan carian, menyokong carian berpaging dan penapisan julat masa, hasil carian termasuk tajuk, URL, ringkasan dan laman web sumber',
        'image_search' => 'Alat carian imej, mencari dan menapis imej berkualiti tinggi secara pintar berdasarkan kata kunci, menyokong analisis pemahaman visual dan penapisan nisbah aspek, deduplikasi automatik memastikan kualiti imej',
        'read_webpages_as_markdown' => 'Alat bacaan laman web berkelompok, mengagregatkan kandungan berbilang laman web dan menukarnya menjadi dokumen Markdown tunggal, menyokong pengambilan kandungan penuh dan mod ringkasan',
        'use_browser' => 'Alat automasi pelayar, menyediakan keupayaan operasi pelayar atom, menyokong navigasi halaman, interaksi elemen, pengisian borang dan operasi modular lain',
        'download_from_urls' => 'Alat muat turun URL berkelompok, menyokong konfigurasi XML untuk berbilang tugas muat turun, mengendalikan pengalihan automatik, mengganti automatik jika fail sasaran sudah wujud',
        'download_from_markdown' => 'Alat muat turun fail Markdown berkelompok, mengekstrak pautan imej dari fail Markdown dan memuat turunnya secara berkelompok, menyokong URL rangkaian dan penyalinan fail tempatan',

        // Pemprosesan Kandungan
        'visual_understanding' => 'Alat pemahaman visual, menganalisis dan mentafsir kandungan imej, menyokong JPEG, PNG, GIF dan format lain, sesuai untuk penerangan pengecaman imej, analisis carta, pengekstrakan teks, perbandingan berbilang imej dan senario lain',
        'convert_pdf' => 'Alat penukaran PDF, menukar fail PDF ke format Markdown, menyokong fail tempatan dan URL, menyediakan mod pintar dan normal, membenarkan menentukan laluan output',
        'voice_understanding' => 'Alat pengecaman pertuturan, menukar fail audio ke teks, menyokong wav, mp3, ogg, m4a dan format lain, boleh membolehkan fungsi pengecaman maklumat penutur',
        'summarize' => 'Alat penapisan maklumat, meningkatkan kepadatan maklumat teks, menghapuskan kandungan berlebihan untuk menjadikannya lebih berstruktur, menyokong keperluan penapisan tersuai dan tetapan panjang sasaran',
        'text_to_image' => 'Alat penjanaan teks-ke-imej, menjana imej berdasarkan prompt teks, menyokong pemilihan berbilang model, membenarkan menyesuaikan saiz, kuantiti dan laluan output',
        'image_edit' => 'Alat penyuntingan imej, menggunakan prompt teks untuk menyunting imej, menyokong penggantian latar belakang, penyingkiran objek dan operasi lain, hanya menyokong model qwen-image-edit',
        'create_slide' => 'Alat penciptaan slaid, menjana slaid HTML dan melaksanakan analisis JavaScript tersuai, menyokong pemeriksaan susun atur dan pengesahan sempadan elemen',
        'create_slide_project' => 'Alat penciptaan projek slaid, mencipta struktur projek lengkap secara automatik, termasuk pengawal persembahan, fail konfigurasi, folder sumber dan skrip komunikasi',
        'create_dashboard_project' => 'Alat penciptaan projek dashboard data, menyalin rangka kerja dashboard data lengkap dari direktori templat, termasuk komponen HTML, CSS, JavaScript dan carta',
        'update_dashboard_template' => 'Alat kemas kini templat dashboard, menyegerakkan fail dashboard.js, index.css, index.html dan config.js dari direktori templat ke projek sedia ada',
        'backup_dashboard_template' => 'Alat pemulihan sandaran templat dashboard, memulihkan versi sandaran fail templat untuk projek yang ditentukan, melaksanakan pertukaran fail semasa dan fail sandaran',
        'finish_dashboard_task' => 'Alat penyiapan projek dashboard, mengautomasikan penyiapan konfigurasi peta dan sumber data, termasuk muat turun GeoJSON, kemas kini konfigurasi HTML dan pengimbasan fail data',

        // Pelaksanaan Sistem
        'shell_exec' => 'Alat pelaksanaan arahan Shell, melaksanakan arahan dan skrip sistem, menyokong tetapan tamat masa dan spesifikasi direktori kerja, sesuai untuk operasi fail, pengurusan proses dan senario pentadbiran sistem lain',
        'python_execute' => 'Alat pelaksanaan kod Python, menjalankan fail skrip Python, menyokong pemindahan argumen baris arahan, kawalan tamat masa dan tetapan direktori kerja, memerlukan menulis kod ke fail dahulu',

        // Bantuan AI
        'create_memory' => 'Alat penciptaan memori jangka panjang, menyimpan keutamaan pengguna, maklumat projek dan memori penting lain, menyokong jenis memori pengguna dan projek, boleh menetapkan sama ada pengesahan pengguna diperlukan',
        'update_memory' => 'Alat kemas kini memori jangka panjang, mengubah suai kandungan memori sedia ada atau maklumat tag, mengesan dan mengemas kini memori yang ditentukan melalui ID memori',
        'delete_memory' => 'Alat pemadaman memori jangka panjang, menghapuskan maklumat memori yang tidak diperlukan sepenuhnya melalui ID memori, digunakan untuk membersihkan data memori yang lapuk atau salah',
        'finish_task' => 'Alat penyiapan tugas, dipanggil apabila semua tugas yang diperlukan selesai, memberikan balasan akhir atau menjeda tugas untuk memberikan maklum balas kepada pengguna, memasuki keadaan berhenti selepas panggilan',
    ],
];
