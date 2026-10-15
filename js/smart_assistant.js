// smart_assistant.js

window.toggleChat = function() {
    const body = document.getElementById('chat-body');
    if (body.style.display === 'none') {
        body.style.display = 'flex';
    } else {
        body.style.display = 'none';
    }
}

window.sendChat = function() {
    const input = document.getElementById('chat-input-field');
    const msg = input.value.trim();
    if (!msg) return;

    const chatMessages = document.getElementById('chat-messages');
    
    // User message
    const userDiv = document.createElement('div');
    userDiv.className = 'msg user';
    userDiv.innerText = msg;
    chatMessages.appendChild(userDiv);
    
    input.value = '';
    
    // Simple bot logic based on keywords
    setTimeout(() => {
        let reply = "لم أفهم ذلك تماماً. يمكنك البحث في قسم المقالات أو حجز استشارة.";
        if (msg.includes('استشارة') || msg.includes('طبيب') || msg.includes('نفسي')) {
            reply = 'يمكنك حجز استشارة طبية أو نفسية من خلال <a href="consultations.html">صفحة الاستشارات</a>.';
        } else if (msg.includes('مقال') || msg.includes('معلومة')) {
            reply = 'تفضل بزيارة <a href="articles.html">مكتبة المقالات</a> للحصول على معلومات موثوقة.';
        } else if (msg.includes('حساب') || msg.includes('تسجيل')) {
            reply = 'يمكنك إنشاء حساب جديد من <a href="register.html">هنا</a>.';
        }

        const botDiv = document.createElement('div');
        botDiv.className = 'msg bot';
        botDiv.innerHTML = reply;
        chatMessages.appendChild(botDiv);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 500);
}
