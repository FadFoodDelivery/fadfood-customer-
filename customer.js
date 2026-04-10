// 1. دالة معالجة رد جوجل بعد تسجيل الدخول الناجح
function handleCredentialResponse(response) {
    // فك تشفير البيانات القادمة من جوجل (JWT Payload)
    const responsePayload = parseJwt(response.credential);
    
    console.log("تم تسجيل الدخول بنجاح لـ: " + responsePayload.name);
    
    // عرض اسم المستخدم في الواجهة
    document.getElementById("displayName").innerText = responsePayload.name;
    
    // إخفاء قسم الدخول وإظهار قسم الطلب
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("orderSection").style.display = "block";
    
    // تشغيل الخريطة بعد إظهار القسم
    initMap();
}

// 2. دالة لفك تشفير بيانات جوجل (JWT)
function parseJwt(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

// 3. تهيئة الخريطة (Leaflet)
let map;
function initMap() {
    // القيروان كموقع افتراضي [خط العرض، خط الطول]
    map = L.map('map').setView([35.6712, 10.0982], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // إضافة علامة للموقع
    L.marker([35.6712, 10.0982]).addTo(map)
        .bindPopup('موقعك الحالي (افتراضي)')
        .openPopup();
        
    // تفعيل زر الطلب عند توفر البيانات
    document.getElementById("confirmBtn").disabled = false;
}

// 4. دالة إرسال الطلب
function submitOrder() {
    const food = document.getElementById("foodItem").value;
    if (!food) {
        alert("الرجاء كتابة ما تود طلبه!");
        return;
    }

    // إخفاء قسم الطلب وإظهار التتبع
    document.getElementById("orderSection").style.display = "none";
    document.getElementById("trackingSection").style.display = "block";
    document.getElementById("statusMessage").innerText = "تم إرسال طلبك (" + food + ") بنجاح! 🛵";
}
