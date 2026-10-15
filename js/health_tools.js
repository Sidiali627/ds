// health_tools.js - Certified Scientific Health Calculators Engine
export function calculateBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
    
    const heightM = heightCm / 100;
    const bmi = (weightKg / (heightM * heightM)).toFixed(1);
    
    let category = '';
    let categoryClass = '';
    let advice = '';

    if (bmi < 18.5) {
        category = 'وزن أقل من الطبيعي';
        categoryClass = 'text-warning';
        advice = 'ينصح بزيادة السعرات الحرارية واستشارة أخصائي تغذية لبناء الكتلة العضلية.';
    } else if (bmi >= 18.5 && bmi <= 24.9) {
        category = 'وزن طبيعي وصحي 🟢';
        categoryClass = 'text-success';
        advice = 'ممتاز! حافظ على نظامك الغذائي المتوازن وممارسة الرياضة المنتظمة.';
    } else if (bmi >= 25 && bmi <= 29.9) {
        category = 'زيادة في الوزن';
        categoryClass = 'text-warning';
        advice = 'ينصح بتقليل السعرات الحرارية اليومية وزيادة النشاط البدني إلى 150 دقيقة أسبوعياً.';
    } else {
        category = 'سمنة (تتطلب متابعة)';
        categoryClass = 'text-danger';
        advice = 'ينصح بمراجعة طبيب المختص لوضع خطة علاجية وتغذوية متكاملة.';
    }

    return { bmi: parseFloat(bmi), category, categoryClass, advice };
}

export function calculateBMR(gender, age, weightKg, heightCm, activityLevel = 1.2) {
    if (!weightKg || !heightCm || !age || weightKg <= 0 || heightCm <= 0 || age <= 0) return null;

    // Mifflin-St Jeor Equation
    let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
    if (gender === 'male') {
        bmr += 5;
    } else {
        bmr -= 161;
    }

    const tdee = Math.round(bmr * parseFloat(activityLevel));
    return {
        bmr: Math.round(bmr),
        tdee: tdee, // Total Daily Energy Expenditure
        weightLossCalories: Math.round(tdee - 500),
        weightGainCalories: Math.round(tdee + 400)
    };
}

export function evaluateMentalHealth(answers) {
    if (!answers || !Array.isArray(answers)) return null;

    const totalScore = answers.reduce((sum, val) => sum + parseInt(val || 0, 10), 0);
    let level = '';
    let recommendation = '';

    if (totalScore <= 4) {
        level = 'مستوى قلق وتوتر منخفض جدًا 🟢';
        recommendation = 'حالتك النفسية ممتازة ومستقرة. استمر في ممارسة التكنيك الذهني والاسترخاء.';
    } else if (totalScore <= 9) {
        level = 'توتر خفيف إلى متوسط 🟡';
        recommendation = 'ينصح بممارسة التمارين الرياضية، تنظيم النوم، والتحدث مع أصدقائك المقربين.';
    } else if (totalScore <= 14) {
        level = 'مستوى ضغط نفسي متوسط إلى مرتفع 🟠';
        recommendation = 'يفضل حجز استشارة مع أخصائي نفسي بالمنصة للحصول على جلسة توجيه وتقييم شامل.';
    } else {
        level = 'مستوى ضغط نفسي مرتفع يتطلب متابعة 🔴';
        recommendation = 'نوصي بشدة بحجز جلسة استشارية فورية مع طبيب أو أخصائي نفسي بالمنصة.';
    }

    return { totalScore, level, recommendation };
}

// Global attachment
if (typeof window !== 'undefined') {
    window.calculateBMI = calculateBMI;
    window.calculateBMR = calculateBMR;
    window.evaluateMentalHealth = evaluateMentalHealth;
}
