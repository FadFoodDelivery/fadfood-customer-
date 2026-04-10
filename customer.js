const socket = io("https://fadfood-server.onrender.com");

let myOrderId = null;
let userLatLng = null;
let map = null;
let marker = null;
let customerEmailGlobal = ""; // سنعتمد على البريد الإلكتروني بدلاً من الهاتف

// --- 🌐 قسم تسجيل الدخول بجوجل ---

// دالة لفك تشفير بيانات جوجل (JWT)
function decodeJwtResponse(token) {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// الدالة التي تعمل فور نجاح تسجيل الدخول بجوجل
function handleCredentialResponse(response) {
    // 1. استخراج بيانات المستخدم
    const responsePayload = decodeJwtResponse(response.credential);
    
    // 2. حفظ الاسم والإيميل
    const name = responsePayload.name;
    customerEmailGlobal = responsePayload.email;

    // 3. الانتقال لقسم الطلبات مباشرة
    document.getElementById('displayName').innerText = name;
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('orderSection').style.display = 'block';
}

// --- 📍 قسم الخرائط والطلبات ---

function getUserLocation() {
    const btn = document.getElementById('locationBtn');
    btn.innerText = "جاري البحث عن موقعك... ⏳";
    btn.disabled = true;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLatLng = { lat: position.coords.latitude, lng: position.coords.longitude };
                btn.innerText = "✅ تم تحديد الموقع بنجاح";
                btn.style.backgroundColor = "var(--success)";
                btn.style.color = "white";

                if (!map) {
                    map = L.map('map').setView([userLatLng.lat, userLatLng.lng], 15);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                    marker = L.marker([userLatLng.lat, userLatLng.lng]).addTo(map);
                } else {
                    map.setView([userLatLng.lat, userLatLng.lng], 15);
                    marker.setLatLng([userLatLng.lat, userLatLng.lng]);
                }
                calculateDelivery();
            },
            () => {
                alert("تعذر الوصول إلى موقعك 📍");
                btn.innerText = "📍 تحديد موقعي عبر الـ GPS";
                btn.disabled = false;
            }
        );
    }
}

function calculateDelivery() {
    const restSelect = document.getElementById('restaurantSelect').value;
    const confirmBtn = document.getElementById('confirmBtn');

    if (userLatLng && restSelect) {
        const [restLat, restLng] = restSelect.split(',');
        const R = 6371; 
        const dLat = (restLat - userLatLng.lat) * Math.PI / 180;
        const dLon = (restLng - userLatLng.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(userLatLng.lat * Math.PI / 180) * Math.cos(restLat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = (R * c).toFixed(2);
        const price = (distance * 1.5).toFixed(2);

        document.getElementById('distanceVal').innerText = distance;
        document.getElementById('priceVal').innerText = price;
        document.getElementById('deliveryInvoice').style.display = 'block';
        confirmBtn.disabled = false;
    } else {
        document.getElementById('deliveryInvoice').style.display = 'none';
        confirmBtn.disabled = true;
    }
}

function submitOrder() {
    const food = document.getElementById('foodItem').value;
    const rest = document.getElementById('restaurantSelect');
    const restName = rest.options[rest.selectedIndex].text;

    if(!food || !rest.value) return alert("الرجاء استكمال الطلب!");

    myOrderId = "FF" + Date.now();
    
    // إرسال الطلب للسيرفر، مع تضمين الإيميل (customerEmailGlobal) بدلاً من الهاتف
    socket.emit('send_order', {
        id: myOrderId,
        client: document.getElementById('displayName').innerText,
        phone: customerEmailGlobal, // سنرسل الإيميل في خانة رقم التواصل مؤقتاً
        items: food + " (من: " + restName + ")",
        location: userLatLng.lat.toFixed(4) + "," + userLatLng.lng.toFixed(4)
    });

    document.getElementById('orderSection').style.display = 'none';
    document.getElementById('trackingSection').style.display = 'block';
}

socket.on('order_status_update', (data) => {
    if(data.id === myOrderId) {
        document.getElementById('statusMessage').innerText = data.status;
        if(data.step === 2) {
            document.getElementById('step1').classList.replace('active', 'completed');
            document.getElementById('step2').classList.add('active');
        } else if (data.step === 3) {
            document.getElementById('step2').classList.replace('active', 'completed');
            document.getElementById('step3').classList.add('active');
        }
    }
});

socket.on('show_order_photo', (data) => {
    if(data.id === myOrderId) {
        document.getElementById('deliveryImage').style.display = 'block';
        document.getElementById('deliveryImage').src = data.photo;
    }
});
