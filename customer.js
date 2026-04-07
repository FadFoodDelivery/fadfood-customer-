// الاتصال بالسيرفر
const socket = io("https://fadfood-server.onrender.com");

let myOrderId = null;
let userLatLng = null;
let map = null;
let marker = null;

// 1. دالة تسجيل الدخول والتحقق من البيانات (UX Validation)
function handleLogin() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();

    // التحقق من الاسم
    if (name === "") {
        alert("الرجاء إدخال اسمك الكامل 👤");
        return;
    }

    // التحقق من رقم الهاتف (8 أرقام فقط)
    const phoneRegex = /^[0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
        alert("الرجاء إدخال رقم هاتف تونسي صحيح يتكون من 8 أرقام 📱");
        return;
    }

    // الانتقال لقسم الطلب
    document.getElementById('displayName').innerText = name;
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('orderSection').style.display = 'block';
}

// 2. دالة جلب موقع المستخدم وعرض الخريطة
function getUserLocation() {
    const btn = document.getElementById('locationBtn');
    
    // تحسين تجربة المستخدم: إظهار رسالة تحميل لمنع الضغط المتكرر
    btn.innerText = "جاري البحث عن موقعك... ⏳";
    btn.disabled = true;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLatLng = { lat: position.coords.latitude, lng: position.coords.longitude };
                
                // تحديث شكل الزر بعد النجاح
                btn.innerText = "✅ تم تحديد الموقع بنجاح";
                btn.style.backgroundColor = "var(--success)";
                btn.style.color = "white";

                // رسم الخريطة إذا لم تكن موجودة
                if (!map) {
                    map = L.map('map').setView([userLatLng.lat, userLatLng.lng], 15);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                    marker = L.marker([userLatLng.lat, userLatLng.lng]).addTo(map);
                } else {
                    map.setView([userLatLng.lat, userLatLng.lng], 15);
                    marker.setLatLng([userLatLng.lat, userLatLng.lng]);
                }

                calculateDelivery(); // حساب التكلفة فوراً
            },
            (error) => {
                alert("تعذر الوصول إلى موقعك. تأكد من تفعيل الـ GPS 📍");
                btn.innerText = "📍 تحديد موقعي عبر الـ GPS";
                btn.disabled = false;
            }
        );
    } else {
        alert("متصفحك لا يدعم تحديد الموقع!");
    }
}

// 3. دالة حساب مسافة وسعر التوصيل
function calculateDelivery() {
    const restSelect = document.getElementById('restaurantSelect').value;
    const confirmBtn = document.getElementById('confirmBtn');

    if (userLatLng && restSelect) {
        const [restLat, restLng] = restSelect.split(',');
        
        // حساب المسافة بخوارزمية (Haversine)
        const R = 6371; // نصف قطر الأرض بالكيلومتر
        const dLat = (restLat - userLatLng.lat) * Math.PI / 180;
        const dLon = (restLng - userLatLng.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(userLatLng.lat * Math.PI / 180) * Math.cos(restLat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = (R * c).toFixed(2); // المسافة بالكيلومتر

        const price = (distance * 1.5).toFixed(2); // التكلفة: 1.5 دينار لكل كيلو

        document.getElementById('distanceVal').innerText = distance;
        document.getElementById('priceVal').innerText = price;
        document.getElementById('deliveryInvoice').style.display = 'block';
        confirmBtn.disabled = false; // تفعيل زر الإرسال
    } else {
        document.getElementById('deliveryInvoice').style.display = 'none';
        confirmBtn.disabled = true;
    }
}

// 4. دالة إرسال الطلب للسيرفر
function submitOrder() {
    const name = document.getElementById('customerName').value;
    const food = document.getElementById('foodItem').value;
    const rest = document.getElementById('restaurantSelect');
    const restName = rest.options[rest.selectedIndex].text;

    if(!food || !rest.value) return alert("الرجاء كتابة طلبك واختيار المطعم!");

    myOrderId = "FF" + Date.now();
    
    // إرسال البيانات للسيرفر
    socket.emit('send_order', {
        id: myOrderId,
        client: name,
        items: food + " (من: " + restName + ")",
        location: "إحداثيات: " + userLatLng.lat.toFixed(4) + "," + userLatLng.lng.toFixed(4)
    });

    document.getElementById('orderSection').style.display = 'none';
    document.getElementById('trackingSection').style.display = 'block';
}

// 5. استقبال التحديثات من السيرفر (التتبع)
socket.on('order_status_update', (data) => {
    if(data.id === myOrderId) {
        document.getElementById('statusMessage').innerText = data.status;
        
        // تحديث شريط التتبع (Stepper)
        if(data.step === 2) {
            document.getElementById('step1').classList.replace('active', 'completed');
            document.getElementById('step2').classList.add('active');
        } else if (data.step === 3) {
            document.getElementById('step2').classList.replace('active', 'completed');
            document.getElementById('step3').classList.add('active');
        }
    }
});

// 6. استقبال صورة الطلب من العامل
socket.on('show_order_photo', (data) => {
    if(data.id === myOrderId) {
        document.getElementById('deliveryImage').style.display = 'block';
        document.getElementById('deliveryImage').src = data.photo;
        
        // تشغيل صوت تنبيه خفيف
        new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(()=>{});
    }
});
