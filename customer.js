let socket;
let map, userMarker, restaurantMarker;
let userLatLng = null;
let currentOrderId = null;

const alertSound = new Audio('bell.mp3');

// بيانات حساب الحريف
let customerData = { name: '', phone: '' };

// 1. الانتقال من صفحة تسجيل الدخول إلى صفحة الطلب
function handleLogin() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    
    if (!name ||!phone) {
        alert("الرجاء إدخال اسمك ورقم هاتفك للمتابعة.");
        return;
    }

    // حفظ بيانات الحريف
    customerData.name = name;
    customerData.phone = phone;
    document.getElementById('displayName').innerText = name.split(' '); // إظهار الاسم الأول فقط للترحيب

    // تفعيل سياسة تشغيل الصوت في المتصفح بعد أول تفاعل
    alertSound.play().then(() => alertSound.pause()).catch(() => {});

    // إخفاء صفحة الدخول وإظهار صفحة الطلب والخريطة (بدون تحديث الصفحة)
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('orderSection').style.display = 'block';

    // تهيئة الخريطة للعمل
    initMap();

    // الاتصال بخادم Socket.io الخاص بك على Render
    socket = io('https://fadfood-backend.onrender.com');
    setupSocketListeners();
}

// 2. تهيئة الخريطة لمدينة القيروان
function initMap() {
    // التمركز مبدئياً على وسط القيروان
    map = L.map('map').setView([35.6727, 10.0949], 13); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
}

// 3. تحديد موقع الحريف بدقة عبر GPS
function getUserLocation() {
    if (navigator.geolocation) {
        // نغير النص ليعرف المستخدم أننا نبحث عن موقعه
        const btn = document.querySelector('.location-btn');
        btn.innerText = "⏳ جاري تحديد الموقع...";

        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            userLatLng = L.latLng(lat, lng);
            
            // رسم علامة للمستخدم على الخريطة
            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.marker(userLatLng).addTo(map).bindPopup("📍 موقع التوصيل الخاص بك").openPopup();
            
            // تحريك الكاميرا نحو المستخدم
            map.flyTo(userLatLng, 15);
            btn.innerText = "✅ تم التحديد بنجاح";
            btn.style.backgroundColor = "var(--success)";
            
            // إعادة حساب السعر لو كان قد اختار المطعم بالفعل
            calculateDelivery(); 
        }, () => {
            alert("يرجى تفعيل الـ GPS والسماح للمتصفح بتحديد موقعك.");
            btn.innerText = "📍 تحديد موقعي عبر الـ GPS";
        }, { enableHighAccuracy: true });
    } else {
        alert("عذراً، متصفحك لا يدعم تحديد الموقع.");
    }
}

// 4. حساب المسافة والسعر (1.5 دينار لكل 1 كيلومتر)
function calculateDelivery() {
    const restCoords = document.getElementById('restaurantSelect').value;
    
    if (restCoords && userLatLng) {
        // تحويل نص الإحداثيات إلى أرقام
        const [restLat, restLng] = restCoords.split(',').map(Number);
        const restLatLng = L.latLng(restLat, restLng);

        // وضع علامة المطعم على الخريطة
        if (restaurantMarker) map.removeLayer(restaurantMarker);
        restaurantMarker = L.marker(restLatLng).addTo(map).bindPopup("🍔 المطعم المختار").openPopup();
        
        // تعديل زوم الخريطة ليظهر الحريف والمطعم معاً
        map.fitBounds(L.latLngBounds(userLatLng, restLatLng), { padding:  });

        // حساب المسافة (مكتبة Leaflet تعيد المسافة بالأمتار)
        const distanceMeters = userLatLng.distanceTo(restLatLng);
        const distanceKm = (distanceMeters / 1000).toFixed(2);
        
        // حساب التكلفة (مع حد أدنى 2 دينار تونسي لتغطية النفقات الأساسية)
        let price = (distanceKm * 1.5);
        if (price < 2) price = 2.00;

        // عرض الفاتورة المصغرة للحريف
        document.getElementById('distanceVal').innerText = distanceKm;
        document.getElementById('priceVal').innerText = price.toFixed(2);
        document.getElementById('deliveryInvoice').style.display = 'block';
        
        // السماح بإرسال الطلب الآن
        document.getElementById('confirmBtn').disabled = false;
    }
}

// 5. إرسال الطلب النهائي
function submitOrder() {
    const food = document.getElementById('foodItem').value.trim();
    if (!food) return alert('الرجاء كتابة الوجبات التي تريد طلبها أولاً!');
    if (!userLatLng) return alert('الرجاء الضغط على زر تحديد موقعي على الخريطة!');

    const restSelect = document.getElementById('restaurantSelect');
    const restName = restSelect.options.text;
    const finalPrice = document.getElementById('priceVal').innerText;

    // توليد رقم طلب فريد
    currentOrderId = "ORD-" + Math.floor(Math.random() * 100000);
    
    // تجميع بيانات الطلب
    const orderData = { 
        id: currentOrderId, 
        customerName: customerData.name,
        customerPhone: customerData.phone,
        food: food,
        restaurant: restName,
        address: `خط العرض: ${userLatLng.lat.toFixed(4)}، خط الطول: ${userLatLng.lng.toFixed(4)}`, // سيرى العامل الإحداثيات لفتحها في خرائطه
        deliveryPrice: finalPrice,
        status: 'في انتظار الموافقة'
    };

    // الإرسال للسيرفر
    socket.emit('new_order', orderData);

    // إخفاء صفحة الطلب والانتقال لصفحة التتبع (SPA)
    document.getElementById('orderSection').style.display = 'none';
    document.getElementById('trackingSection').style.display = 'block';
}

// 6. الاستماع لتحديثات حالة الطلب اللحظية
function setupSocketListeners() {
    socket.on('status_updated', (data) => {
        // التأكد أن التحديث يخص طلب هذا الحريف فقط
        if (data.orderId === currentOrderId) {
            
            // تشغيل صوت تنبيه
            alertSound.play().catch(e => console.log("التنبيه الصوتي يعمل", e));
            
            // تحديث النص
            document.getElementById('statusMessage').innerText = data.statusText;
            
            // تحديث تصميم الـ Stepper ديناميكياً
            if (data.step >= 1) document.getElementById('step1').className = 'step completed';
            
            if (data.step >= 2) {
                document.getElementById('step2').className = data.step === 2? 'step active' : 'step completed';
            }
            
            if (data.step === 3) {
                document.getElementById('step3').className = 'step completed';
            }

            // إذا قام العامل بإرفاق صورة التوصيل كبيانات ثنائية
            if (data.imageBuffer) {
                const blob = new Blob(, { type: 'image/jpeg' });
                const imgUrl = URL.createObjectURL(blob);
                const imgElement = document.getElementById('deliveryImage');
                imgElement.src = imgUrl;
                imgElement.style.display = 'block';
            }
        }
    });
}
