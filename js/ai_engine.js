// ai_engine.js

/**
 * AI Engine for communicating with Language Models (OpenAI / Gemini)
 * WARNING: This is client-side implementation for demonstration/SaaS prototype. 
 * In production, the API Key should NEVER be sent from the browser directly.
 */

export async function askAI(messages, settings) {
    if (!settings.api_key) {
        throw new Error("لم يتم إعداد مفتاح الـ API. يرجى إضافته من إعدادات الذكاء الاصطناعي.");
    }

    if (settings.provider === 'openai') {
        return await callOpenAI(messages, settings);
    } else if (settings.provider === 'gemini') {
        return await callGemini(messages, settings);
    } else {
        throw new Error("مزود الخدمة غير مدعوم.");
    }
}

async function callOpenAI(messages, settings) {
    const url = "https://api.openai.com/v1/chat/completions";
    
    // Ensure the system prompt is the first message
    const formattedMessages = [
        { role: "system", content: settings.system_prompt || "أنت مساعد ذكي." },
        ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const body = {
        model: settings.model || "gpt-4o",
        messages: formattedMessages,
        temperature: settings.temperature || 0.7
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings.api_key}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "فشل الاتصال بـ OpenAI");
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callGemini(messages, settings) {
    // Gemini uses a different format, usually Google AI Studio endpoint
    const model = settings.model || "gemini-1.5-pro";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.api_key}`;

    const formattedContents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    // Add system instruction if supported or just append to first message
    if (settings.system_prompt) {
        if(formattedContents.length > 0) {
            formattedContents[0].parts[0].text = `System: ${settings.system_prompt}\n\n` + formattedContents[0].parts[0].text;
        }
    }

    const body = {
        contents: formattedContents,
        generationConfig: {
            temperature: settings.temperature || 0.7
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "فشل الاتصال بـ Gemini");
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}
