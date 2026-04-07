const express = require('express');
const mongoose = require('mongoose');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
    cors: { origin: "*" }, 
    maxHttpBufferSize: 1e7 
});

// 1. الربط بـ MongoDB (استخدمنا المتغير السري للأمان)
const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB Connected ✅"))
    .catch(err => console.log("Connection Error: ", err));

// تعريف موديل العامل في القاعدة
const Worker = mongoose.model('Worker', new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    count: { type: Number, default: 0 }
}));

// قوائم الذاكرة المؤقتة
let orders = [];
let onlineWorkers = [];
let otps = {}; // 🧠 ذاكرة حفظ أكواد التفعيل

io.on('connection', async (socket) => {
    
    // دالة تحديث النظام وإرسالها للجميع
    const broadcastUpdate = async () => {
        const workersFromDB = await Worker.find();
        let workersDB = {};
        let stats = {};
        workersFromDB.forEach(w => {
            workersDB[w.username] = w.password;
            stats[w.username] = { count: w.count };
        });
        io.emit('update_system', { orders, stats, workersDB, onlineWorkers });
    };

    await broadcastUpdate();

    // --- 💬 قسم الواتساب (OTP) ---
    socket.on('request_otp', (data) => {
        const code = Math.floor(1000 + Math.random() * 9000).toString(); // توليد 4 أرقام
        otps[data.phone] = code; // حفظ الكود
        
        // محاكاة إرسال الرسالة (تظهر في Logs موقع Render)
        console.log(`💬 رسالة واتساب إلى ${data.phone}: كود تفعيل FadFood هو ${code}`);
    });

    socket.on('verify_otp', (data) => {
        if (otps[data.phone] && otps[data.phone] === data.code) {
            delete otps[data.phone]; // حذف الكود للأمان
            socket.emit('otp_result', { success: true });
        } else {
            socket.emit('otp_result', { success: false });
        }
    });

    // --- 🛡️ قسم إدارة العمال (المدير) ---
    socket.on('admin_add_worker', async (data) => {
        try {
            await Worker.findOneAndUpdate(
                { username: data.username.toLowerCase().trim() },
                { password: data.password },
                { upsert: true, new: true }
            );
            await broadcastUpdate(); 
        } catch (e) { console.log("Add Error:", e); }
    });

    socket.on('admin_remove_worker', async (username) => {
        await Worker.deleteOne({ username });
        await broadcastUpdate();
    });

    socket.on('worker_online', async (name) => {
        if(!onlineWorkers.includes(name)) onlineWorkers.push(name);
        await broadcastUpdate();
    });

    socket.on('worker_offline', async (name) => {
        onlineWorkers = onlineWorkers.filter(n => n !== name);
        await broadcastUpdate();
    });

    // --- 🍔 قسم إدارة الطلبات ---
    socket.on('send_order', (data) => {
        orders.push({ 
            id: data.id, 
            client: data.client, 
            phone: data.phone, // 📱 حفظنا رقم الهاتف هنا!
            items: data.items, 
            location: data.location,
            status: 'انتظار ⏳', 
            step: 1 
        });
        broadcastUpdate();
    });

    socket.on('accept_order', (data) => {
        let order = orders.find(o => o.id == data.id);
        if(order) {
            order.worker = data.worker;
            order.status = 'قيد التحضير 👨‍🍳';
            io.emit('order_status_update', order);
            broadcastUpdate();
        }
    });

    socket.on('order_photo', (data) => {
        let order = orders.find(o => o.id == data.id);
        if(order) {
            order.status = 'تم التجهيز 📸';
            order.step = 3;
            io.emit('show_order_photo', data);
            io.emit('order_status_update', order);
        }
    });

    socket.on('deliver_order', async (data) => {
        orders = orders.filter(o => o.id != data.id);
        await Worker.updateOne({ username: data.worker }, { $inc: { count: 1 } });
        await broadcastUpdate();
    });
});

http.listen(process.env.PORT || 3000, () => {
    console.log("FadFood Server is running 🚀");
});
