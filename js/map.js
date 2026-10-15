// map.js
import { supabase } from './supabase.js';

// SVG map of Algeria (simplified for demo purposes, you can replace with a full SVG)
const algeriaSvg = `
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
    <!-- Simplified representation. In production, use standard Algeria 58 wilayas SVG -->
    <rect x="0" y="0" width="800" height="600" fill="#f8fafc" />
    <circle cx="400" cy="300" r="150" fill="#cbd5e1" class="wilaya-region" data-id="16" data-name="الجزائر العاصمة" />
    <circle cx="200" cy="200" r="80" fill="#cbd5e1" class="wilaya-region" data-id="31" data-name="وهران" />
    <circle cx="600" cy="200" r="80" fill="#cbd5e1" class="wilaya-region" data-id="25" data-name="قسنطينة" />
    <circle cx="400" cy="500" r="100" fill="#cbd5e1" class="wilaya-region" data-id="11" data-name="تمنراست" />
    <text x="400" y="580" text-anchor="middle" fill="#64748b">(خريطة تجريبية تفاعلية، اضغط على الدوائر)</text>
</svg>
`;

async function initMap() {
    const container = document.getElementById('algeria-map-container');
    if (!container) return;
    
    container.innerHTML = algeriaSvg;
    
    const infoBox = document.getElementById('map-info-box');
    const regions = container.querySelectorAll('.wilaya-region');
    
    // Fetch real stats from DB if available
    let wilayasStats = [];
    if(supabase) {
        try {
            const { data } = await supabase.from('wilayas_stats').select('*');
            wilayasStats = data || [];
        } catch(e){}
    }

    regions.forEach(region => {
        region.addEventListener('mouseenter', (e) => {
            const id = parseInt(region.getAttribute('data-id'));
            const name = region.getAttribute('data-name');
            const stat = wilayasStats.find(s => s.id === id);
            
            infoBox.style.display = 'block';
            infoBox.innerHTML = `
                <strong>ولاية ${name}</strong><br>
                الأنشطة: ${stat ? stat.activities_count : Math.floor(Math.random()*10)}<br>
                المتطوعين: ${stat ? stat.volunteers_count : Math.floor(Math.random()*50)}
            `;
            
            // Positioning
            infoBox.style.left = (e.clientX + 10) + 'px';
            infoBox.style.top = (e.clientY + 10) + 'px';
            region.style.fill = 'var(--primary-color)';
        });
        
        region.addEventListener('mousemove', (e) => {
            infoBox.style.left = (e.clientX + 10) + 'px';
            infoBox.style.top = (e.clientY + 10) + 'px';
        });

        region.addEventListener('mouseleave', () => {
            infoBox.style.display = 'none';
            region.style.fill = '#cbd5e1';
        });
    });
}

document.addEventListener('DOMContentLoaded', initMap);
