// 1. Cấu hình kết nối Supabase
const SUPABASE_URL = "https://wmrwpgkswtyhnbwakqof.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_IW4hkBCbFwLP8oYTzM61SQ_piURcKbk";

const BUCKET_NAME = "Tai_lieu"; // Tên Bucket bạn tạo trong mục Storage

// Chờ giao diện tải xong thì tự động lấy danh sách tài liệu cũ ra
document.addEventListener("DOMContentLoaded", fetchDocuments);

// Lắng nghe sự kiện click nút Tải lên
document.getElementById("upload-btn").addEventListener("click", handleUpload);

// Hàm xử lý khi bấm nút Tải lên
async function handleUpload() {
    const fileInput = document.getElementById("file-input");
    const categoryInput = document.getElementById("category-input");
    
    const file = fileInput.files[0];
    const category = categoryInput.value.trim() || "Chưa phân loại";

    if (!file) {
        alert("Vui lòng chọn một file trước!");
        return;
    }

    // Tạo một tên file duy nhất để tránh bị trùng lặp trên Storage công khai
    const uniqueFileName = `${Date.now()}_${file.name}`;

    try {
        // BƯỚC A: Đẩy file vật lý lên Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(uniqueFileName, file);

        if (storageError) throw storageError;

        // Lấy đường link URL công khai của file vừa tải lên
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(uniqueFileName);
            
        const fileUrl = urlData.publicUrl;
        const fileSizeStr = (file.size / (1024 * 1024)).toFixed(2) + " MB";

        // BƯỚC B: Lưu thông tin file vào bảng SQL 'documents'
        const { error: dbError } = await supabase
            .from("documents")
            .insert([
                { 
                    file_name: file.name, 
                    file_url: fileUrl, 
                    file_size: fileSizeStr, 
                    category: category 
                }
            ]);

        if (dbError) throw dbError;

        alert("Tải lên tài liệu thành công!");
        
        // Reset ô nhập dữ liệu và tải lại danh sách mới
        fileInput.value = "";
        categoryInput.value = "";
        fetchDocuments();

    } catch (error) {
        console.error(error);
        alert("Có lỗi xảy ra: " + error.message);
    }
}

// Hàm lấy dữ liệu từ bảng SQL về hiển thị lên giao diện
async function fetchDocuments() {
    const docListContainer = document.getElementById("document-list");

    const { data: documents, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false }); // File mới nhất lên đầu

    if (error) {
        docListContainer.innerHTML = "<p>Không thể tải dữ liệu.</p>";
        console.error(error);
        return;
    }

    if (documents.length === 0) {
        docListContainer.innerHTML = "<p>Kho tài liệu trống. Hãy tải lên file đầu tiên!</p>";
        return;
    }

    // Xóa nội dung cũ, duyệt qua mảng dữ liệu để render card mới
    docListContainer.innerHTML = "";
    documents.forEach(doc => {
        const card = document.createElement("div");
        card.className = "doc-card";
        card.innerHTML = `
            <h3>${doc.file_name}</h3>
            <p><strong>Dung lượng:</strong> ${doc.file_size}</p>
            <p><strong>Danh mục:</strong> ${doc.category}</p>
            <a href="${doc.file_url}" target="_blank" class="btn-download">Xem / Tải về</a>
        `;
        docListContainer.appendChild(card);
    });
}
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
