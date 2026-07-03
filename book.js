// 1. Cấu hình kết nối Supabase (Đã sửa .coL thành .co)
const SUPABASE_URL = "https://wmrwpgkswtyhnbwakqof.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_IW4hkBCbFwLP8oYTzM61SQ_piURcKbk";

// Khởi tạo client Supabase (Dòng này ở file cũ bị thiếu)
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET_NAME = "Tai_lieu"; 

// Biến lưu trữ toàn bộ danh sách để phục vụ bộ lọc Client-side nhanh hơn
let allDocuments = [];

document.addEventListener("DOMContentLoaded", () => {
    fetchDocuments();
    setupDragAndDrop();

    // Lắng nghe sự kiện lọc danh mục
    document.getElementById("category-filter").addEventListener("change", filterDocuments);
    // Đóng Modal khi bấm nút X
    document.querySelector(".close-modal").addEventListener("click", closeModal);
});

document.getElementById("upload-btn").addEventListener("click", handleUpload);

// --- TÍNH NĂNG 1: XỬ LÝ KÉO THẢ FILE ---
function setupDragAndDrop() {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.add('highlight'); }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.remove('highlight'); }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files.length > 0) {
            fileInput.files = dt.files;
        }
    });
}

// --- TÍNH NĂNG 2: TẢI TỆP LÊN ---
async function handleUpload() {
    const fileInput = document.getElementById("file-input");
    const categoryInput = document.getElementById("category-input");
    
    const file = fileInput.files[0];
    const category = categoryInput.value.trim() || "Chưa phân loại";

    if (!file) {
        alert("Vui lòng chọn một file trước!");
        return;
    }

    const uniqueFileName = `${Date.now()}_${file.name}`;

    try {
        // A. Đẩy file lên Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(uniqueFileName, file);

        if (storageError) throw storageError;

        // Lấy URL công khai
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(uniqueFileName);
            
        const fileUrl = urlData.publicUrl;
        const fileSizeStr = (file.size / (1024 * 1024)).toFixed(2) + " MB";

        // B. Lưu dữ liệu vào SQL (Lưu kèm cả đường dẫn storage_path để sau này xóa tệp vật lý)
        const { error: dbError } = await supabase
            .from("documents")
            .insert([
                { 
                    file_name: file.name, 
                    file_url: fileUrl, 
                    file_size: fileSizeStr, 
                    category: category,
                    storage_path: uniqueFileName // Bạn nên tạo thêm cột này trong database nếu muốn xóa sạch file vật lý
                }
            ]);

        if (dbError) throw dbError;

        alert("Tải lên tài liệu thành công!");
        fileInput.value = "";
        categoryInput.value = "";
        fetchDocuments();

    } catch (error) {
        console.error(error);
        alert("Có lỗi xảy ra: " + error.message);
    }
}

// --- TÍNH NĂNG 3: LẤY VÀ HIỂN THỊ TỆP ---
async function fetchDocuments() {
    const docListContainer = document.getElementById("document-list");

    const { data: documents, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        docListContainer.innerHTML = "<p>Không thể tải dữ liệu.</p>";
        return;
    }

    allDocuments = documents; // Đồng bộ vào mảng tổng
    updateCategoryFilterMenu();
    renderGrid(allDocuments);
}

// Cập nhật danh sách các lựa chọn vào thẻ <select> bộ lọc
function updateCategoryFilterMenu() {
    const filterMenu = document.getElementById("category-filter");
    const categories = ["all", ...new Set(allDocuments.map(d => d.category))];
    
    filterMenu.innerHTML = categories.map(cat => 
        `<option value="${cat}">${cat === 'all' ? 'Tất cả tài liệu' : cat}</option>`
    ).join("");
}

function renderGrid(docsList) {
    const docListContainer = document.getElementById("document-list");
    if (docsList.length === 0) {
        docListContainer.innerHTML = "<p>Không tìm thấy tài liệu phù hợp.</p>";
        return;
    }

    docListContainer.innerHTML = "";
    docsList.forEach(doc => {
        const card = document.createElement("div");
        card.className = "doc-card";
        
        // Nhận diện icon dựa vào đuôi tệp cơ bản
        let icon = "📄";
        const lowerName = doc.file_name.toLowerCase();
        if (/\.(jpg|jpeg|png|gif|webp)$/.test(lowerName)) icon = "🖼️";
        else if (/\.(mp4|mkv|webm)$/.test(lowerName)) icon = "🎬";
        else if (/\.(mp3|wav)$/.test(lowerName)) icon = "🎵";
        else if (lowerName.endsWith('.pdf')) icon = "📕";

        card.innerHTML = `
            <div class="card-header">
                <span class="file-icon">${icon}</span>
                <h3 title="${doc.file_name}">${doc.file_name}</h3>
            </div>
            <div class="card-info">
                <p><strong>Dung lượng:</strong> ${doc.file_size}</p>
                <p><strong>Danh mục:</strong> <span class="badge">${doc.category}</span></p>
            </div>
            <div class="card-actions">
                <button onclick="openPreview('${doc.file_url}', '${doc.file_name}')" class="btn-view">👁️ Xem</button>
                <a href="${doc.file_url}" target="_blank" download="${doc.file_name}" class="btn-download">📥 Tải về</a>
                <button onclick="deleteDocument(${doc.id}, '${doc.storage_path || ''}')" class="btn-delete">🗑️ Xóa</button>
            </div>
        `;
        docListContainer.appendChild(card);
    });
}

function filterDocuments(e) {
    const selected = e.target.value;
    if (selected === "all") {
        renderGrid(allDocuments);
    } else {
        const filtered = allDocuments.filter(d => d.category === selected);
        renderGrid(filtered);
    }
}

// --- TÍNH NĂNG 4: XEM TRƯỚC FILE (MODAL PREVIEW) ---
function openPreview(url, name) {
    const modal = document.getElementById("preview-modal");
    const title = document.getElementById("modal-title");
    const body = document.getElementById("modal-body");
    
    title.textContent = name;
    body.innerHTML = "";
    const lowerName = name.toLowerCase();

    if (/\.(jpg|jpeg|png|gif|webp)$/.test(lowerName)) {
        body.innerHTML = `<img src="${url}" alt="Preview" style="max-width:100%; max-height: 70vh; border-radius:4px;">`;
    } else if (lowerName.endsWith('.pdf')) {
        body.innerHTML = `<iframe src="${url}" width="100%" height="500px" style="border:none;"></iframe>`;
    } else if (/\.(mp4|webm)$/.test(lowerName)) {
        body.innerHTML = `<video src="${url}" controls width="100%" style="max-height:70vh;"></video>`;
    } else if (/\.(mp3|wav)$/.test(lowerName)) {
        body.innerHTML = `<audio src="${url}" controls style="width:100%; margin-top:20px;"></audio>`;
    } else {
        body.innerHTML = `<p>Định dạng tệp này không hỗ trợ xem trực tiếp. Vui lòng bấm Tải về để xem.</p>
                          <a href="${url}" target="_blank" class="btn-download" style="display:inline-block;">Mở tab mới</a>`;
    }
    modal.style.display = "block";
}

function closeModal() {
    document.getElementById("preview-modal").style.display = "none";
    document.getElementById("modal-body").innerHTML = ""; // Tắt nhạc/video chạy ngầm khi đóng
}

// --- TÍNH NĂNG 5: XÓA TÀI LIỆU ---
async function deleteDocument(id, storagePath) {
    if (!confirm("Bạn có chắc chắn muốn xóa tài liệu này không?")) return;

    try {
        // A. Xóa tệp vật lý trên Storage (nếu có lưu path)
        if (storagePath) {
            await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        }

        // B. Xóa dữ liệu trong bảng SQL documents
        const { error } = await supabase
            .from("documents")
            .delete()
            .eq("id", id);

        if (error) throw error;

        alert("Xóa tài liệu thành công!");
        fetchDocuments(); // Tải lại lưới
    } catch (error) {
        alert("Lỗi khi xóa: " + error.message);
    }
}
