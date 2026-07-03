// Cấu hình kết nối Supabase - Đã đổi tên thực thể tránh trùng lặp gây xung đột cú pháp
const SUPABASE_URL = "https://wmrwpgkswtyhnbwakqof.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_IW4hkBCbFwLP8oYTzM61SQ_piURcKbk";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET_NAME = "Tai_lieu"; 

let allDocuments = [];
let currentCategory = "all";
let currentViewMode = "grid"; // 'grid' hoặc 'list'

document.addEventListener("DOMContentLoaded", () => {
    fetchDocuments();
    setupDragAndDrop();
    setupToolbarEvents();
});

// Thiết lập kéo thả tệp trực quan
function setupDragAndDrop() {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");

    fileInput.addEventListener("change", () => {
        if(fileInput.files.length > 0) {
            document.querySelector(".btn-select-file").textContent = `📁 ${fileInput.files[0].name}`;
        }
    });

    ['dragenter', 'dragover'].forEach(name => {
        dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('highlight'); });
    });
    ['dragleave', 'drop'].forEach(name => {
        dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('highlight'); });
    });
    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            document.querySelector(".btn-select-file").textContent = `📁 ${e.dataTransfer.files[0].name}`;
        }
    });
}

// Thiết lập thanh công cụ & Tìm kiếm dữ liệu
function setupToolbarEvents() {
    document.getElementById("upload-btn").addEventListener("click", handleUpload);
    document.querySelector(".close-modal").addEventListener("click", closeModal);
    
    // Tìm kiếm tệp thời gian thực (Realtime Search)
    document.getElementById("search-input").addEventListener("input", filterAndRender);

    // Chuyển chế độ hiển thị Lưới / Danh sách
    const gridBtn = document.getElementById("view-grid-btn");
    const listBtn = document.getElementById("view-list-btn");

    gridBtn.addEventListener("click", () => {
        currentViewMode = "grid";
        gridBtn.classList.add("active");
        listBtn.classList.remove("active");
        filterAndRender();
    });

    listBtn.addEventListener("click", () => {
        currentViewMode = "list";
        listBtn.classList.add("active");
        gridBtn.classList.remove("active");
        filterAndRender();
    });
}

// Hàm tải tệp lên
async function handleUpload() {
    const fileInput = document.getElementById("file-input");
    const categoryInput = document.getElementById("category-input");
    
    const file = fileInput.files[0];
    const category = categoryInput.value.trim() || "Chưa phân loại";

    if (!file) {
        alert("Vui lòng chọn hoặc kéo thả một file trước!");
        return;
    }

    const uniqueFileName = `${Date.now()}_${file.name}`;

    try {
        const { data: storageData, error: storageError } = await supabaseClient.storage
            .from(BUCKET_NAME)
            .upload(uniqueFileName, file);

        if (storageError) throw storageError;

        const { data: urlData } = supabaseClient.storage
            .from(BUCKET_NAME)
            .getPublicUrl(uniqueFileName);
            
        const fileUrl = urlData.publicUrl;
        const fileSizeStr = (file.size / (1024 * 1024)).toFixed(2) + " MB";

        const { error: dbError } = await supabaseClient
            .from("documents")
            .insert([{ 
                file_name: file.name, 
                file_url: fileUrl, 
                file_size: fileSizeStr, 
                category: category,
                storage_path: uniqueFileName
            }]);

        if (dbError) throw dbError;

        alert("Tải lên tài liệu thành công!");
        fileInput.value = "";
        categoryInput.value = "";
        document.querySelector(".btn-select-file").textContent = "➕ Tải tệp lên";
        fetchDocuments();

    } catch (error) {
        alert("Có lỗi xảy ra: " + error.message);
    }
}

// Lấy danh sách tệp từ dữ liệu
async function fetchDocuments() {
    const docListContainer = document.getElementById("document-list");

    try {
        const { data: documents, error } = await supabaseClient
            .from("documents")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        allDocuments = documents || [];
        renderSidebarCategories();
        filterAndRender();

    } catch (error) {
        console.error(error);
        docListContainer.innerHTML = `<p style="color:red;">❌ Lỗi kết nối: ${error.message}</p>`;
    }
}

// Tạo cấu trúc danh mục bên cây danh mục (Sidebar Tree)
function renderSidebarCategories() {
    const treeContainer = document.getElementById("category-tree");
    const uniqueCategories = [...new Set(allDocuments.map(d => d.category))];

    let html = `<li class="${currentCategory === 'all' ? 'active' : ''}" data-category="all">📁 Tất cả tài liệu</li>`;
    uniqueCategories.forEach(cat => {
        html += `<li class="${currentCategory === cat ? 'active' : ''}" data-category="${cat}">📁 ${cat}</li>`;
    });

    treeContainer.innerHTML = html;

    // Gán sự kiện click lọc cho cây thư mục
    treeContainer.querySelectorAll("li").forEach(li => {
        li.addEventListener("click", () => {
            treeContainer.querySelectorAll("li").forEach(el => el.classList.remove("active"));
            li.classList.add("active");
            currentCategory = li.getAttribute("data-category");
            document.getElementById("current-folder-title").textContent = `📁 ${li.textContent.replace('📁 ', '')}`;
            filterAndRender();
        });
    });
}

// Hàm lọc kết hợp cả Danh mục và Thanh tìm kiếm dữ liệu thời gian thực
function filterAndRender() {
    const searchText = document.getElementById("search-input").value.toLowerCase();
    
    let filtered = allDocuments;

    // 1. Lọc theo danh mục trước
    if (currentCategory !== "all") {
        filtered = filtered.filter(d => d.category === currentCategory);
    }

    // 2. Lọc tiếp theo từ khóa tìm kiếm
    if (searchText) {
        filtered = filtered.filter(d => d.file_name.toLowerCase().includes(searchText));
    }

    document.getElementById("file-count-status").textContent = `Hiển thị ${filtered.length} tài liệu`;

    renderExplorerGrid(filtered);
}

// Render dữ liệu linh hoạt theo kiểu Grid hoặc List của File Explorer
function renderExplorerGrid(docsList) {
    const container = document.getElementById("document-list");
    
    // Cập nhật class hiển thị tương ứng
    if (currentViewMode === "list") {
        container.className = "doc-list-view";
        container.innerHTML = `
            <div class="list-header">
                <div>Tên tệp tin</div>
                <div>Kích thước</div>
                <div>Thư mục</div>
                <div style="text-align:right;">Hành động</div>
            </div>
        `;
    } else {
        container.className = "doc-grid";
        container.innerHTML = "";
    }

    if (docsList.length === 0) {
        container.insertAdjacentHTML('beforeend', '<p class="empty-msg">Thư mục trống hoặc không có kết quả tìm kiếm thích hợp.</p>');
        return;
    }

    docsList.forEach(doc => {
        let icon = "📄";
        const lowerName = doc.file_name.toLowerCase();
        if (/\.(jpg|jpeg|png|gif|webp)$/.test(lowerName)) icon = "🖼️";
        else if (/\.(mp4|mkv|webm)$/.test(lowerName)) icon = "🎬";
        else if (/\.(mp3|wav)$/.test(lowerName)) icon = "🎵";
        else if (lowerName.endsWith('.pdf')) icon = "📕";

        if (currentViewMode === "grid") {
            // Chế độ xem dạng Lưới Ô Vuông
            const item = document.createElement("div");
            item.className = "explorer-card";
            item.innerHTML = `
                <div class="file-icon-large">${icon}</div>
                <div class="file-name-label" title="${doc.file_name}">${doc.file_name}</div>
                <div class="file-meta-label">${doc.file_size}</div>
                <div class="explorer-card-actions">
                    <button onclick="openPreview('${doc.file_url}', '${doc.file_name}')" title="Xem nhanh">👁️</button>
                    <a href="${doc.file_url}" target="_blank" download="${doc.file_name}" title="Tải xuống">📥</a>
                    <button onclick="deleteDocument(${doc.id}, '${doc.storage_path || ''}')" title="Xóa tệp" class="btn-del">🗑️</button>
                </div>
            `;
            container.appendChild(item);
        } else {
            // Chế độ xem dạng Hàng Danh Sách (List Row)
            const row = document.createElement("div");
            row.className = "explorer-row";
            row.innerHTML = `
                <div class="row-name"><span style="margin-right:8px;">${icon}</span> <span title="${doc.file_name}">${doc.file_name}</span></div>
                <div class="row-size">${doc.file_size}</div>
                <div class="row-cat"><span class="folder-badge">${doc.category}</span></div>
                <div class="row-actions">
                    <button onclick="openPreview('${doc.file_url}', '${doc.file_name}')" class="btn-text">Xem</button>
                    <a href="${doc.file_url}" target="_blank" download="${doc.file_name}" class="btn-text">Tải về</a>
                    <button onclick="deleteDocument(${doc.id}, '${doc.storage_path || ''}')" class="btn-text text-danger">Xóa</button>
                </div>
            `;
            container.appendChild(row);
        }
    });
}

// Quản lý cửa sổ Xem trực tiếp
function openPreview(url, name) {
    const modal = document.getElementById("preview-modal");
    const body = document.getElementById("modal-body");
    document.getElementById("modal-title").textContent = name;
    body.innerHTML = "";
    
    const lowerName = name.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp)$/.test(lowerName)) {
        body.innerHTML = `<img src="${url}" style="max-width:100%; max-height:70vh; border-radius:4px;">`;
    } else if (lowerName.endsWith('.pdf')) {
        body.innerHTML = `<iframe src="${url}" width="100%" height="520px" style="border:none;"></iframe>`;
    } else if (/\.(mp4|webm)$/.test(lowerName)) {
        body.innerHTML = `<video src="${url}" controls width="100%"></video>`;
    } else if (/\.(mp3|wav)$/.test(lowerName)) {
        body.innerHTML = `<audio src="${url}" controls style="width:100%; margin-top:20px;"></audio>`;
    } else {
        body.innerHTML = `<p>Định dạng tệp không hỗ trợ xem thử trực tuyến.</p><a href="${url}" target="_blank" class="btn-select-file" style="display:inline-block; margin-top:10px;">Mở ở tab mới</a>`;
    }
    modal.style.display = "block";
}

function closeModal() {
    document.getElementById("preview-modal").style.display = "none";
    document.getElementById("modal-body").innerHTML = "";
}

// Tiến trình xử lý Xóa tệp dữ liệu
async function deleteDocument(id, storagePath) {
    if (!confirm("Bạn có đồng ý xóa vĩnh viễn tệp tin này không?")) return;

    try {
        if (storagePath) {
            await supabaseClient.storage.from(BUCKET_NAME).remove([storagePath]);
        }
        const { error } = await supabaseClient.from("documents").delete().eq("id", id);
        if (error) throw error;

        fetchDocuments();
    } catch (error) {
        alert("Lỗi hệ thống khi xóa: " + error.message);
    }
}
