-- Supabase Migration: 20240101000004_homepage_schema.sql

-- 1. Campaigns Table (الحملات الوطنية)
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT,
    image_url VARCHAR,
    progress INT DEFAULT 0,
    target INT DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Partners Table (الشركاء والرعاة)
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR NOT NULL,
    logo_url VARCHAR NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Digital Library Table (المكتبة الرقمية)
CREATE TABLE IF NOT EXISTS public.digital_library (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR NOT NULL,
    type VARCHAR NOT NULL, -- book, pdf, video, image, guide
    url VARCHAR NOT NULL,
    thumbnail_url VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Wilayas Stats Table (إحصائيات خريطة الجزائر)
CREATE TABLE IF NOT EXISTS public.wilayas_stats (
    id INT PRIMARY KEY, -- 1 to 58
    name_ar VARCHAR NOT NULL,
    name_fr VARCHAR,
    activities_count INT DEFAULT 0,
    volunteers_count INT DEFAULT 0,
    beneficiaries_count INT DEFAULT 0,
    campaigns_count INT DEFAULT 0
);

-- Initialize Wilayas (1 to 58 basic seed)
INSERT INTO public.wilayas_stats (id, name_ar, name_fr) VALUES
(1, 'أدرار', 'Adrar'), (2, 'الشلف', 'Chlef'), (3, 'الأغواط', 'Laghouat'), (4, 'أم البواقي', 'Oum El Bouaghi'),
(5, 'باتنة', 'Batna'), (6, 'بجاية', 'Béjaïa'), (7, 'بسكرة', 'Biskra'), (8, 'بشار', 'Béchar'),
(9, 'البليدة', 'Blida'), (10, 'البويرة', 'Bouira'), (11, 'تمنراست', 'Tamanrasset'), (12, 'تبسة', 'Tébessa'),
(13, 'تلمسان', 'Tlemcen'), (14, 'تيارت', 'Tiaret'), (15, 'تيزي وزو', 'Tizi Ouzou'), (16, 'الجزائر', 'Alger'),
(17, 'الجلفة', 'Djelfa'), (18, 'جيجل', 'Jijel'), (19, 'سطيف', 'Sétif'), (20, 'سعيدة', 'Saïda'),
(21, 'سكيكدة', 'Skikda'), (22, 'سيدي بلعباس', 'Sidi Bel Abbès'), (23, 'عنابة', 'Annaba'), (24, 'قالمة', 'Guelma'),
(25, 'قسنطينة', 'Constantine'), (26, 'المدية', 'Médéa'), (27, 'مستغانم', 'Mostaganem'), (28, 'المسيلة', 'M''Sila'),
(29, 'معسكر', 'Mascara'), (30, 'ورقلة', 'Ouargla'), (31, 'وهران', 'Oran'), (32, 'البيض', 'El Bayadh'),
(33, 'إليزي', 'Illizi'), (34, 'برج بوعريريج', 'Bordj Bou Arreridj'), (35, 'بومرداس', 'Boumerdès'), (36, 'الطارف', 'El Tarf'),
(37, 'تندوف', 'Tindouf'), (38, 'تيسمسيلت', 'Tissemsilt'), (39, 'الوادي', 'El Oued'), (40, 'خنشلة', 'Khenchela'),
(41, 'سوق أهراس', 'Souk Ahras'), (42, 'تيبازة', 'Tipaza'), (43, 'ميلة', 'Mila'), (44, 'عين الدفلى', 'Aïn Defla'),
(45, 'النعامة', 'Naâma'), (46, 'عين تموشنت', 'Aïn Témouchent'), (47, 'غرداية', 'Ghardaïa'), (48, 'غليزان', 'Relizane'),
(49, 'تيميمون', 'Timimoun'), (50, 'برج باجي مختار', 'Bordj Badji Mokhtar'), (51, 'أولاد جلال', 'Ouled Djellal'), (52, 'بني عباس', 'Béni Abbès'),
(53, 'عين صالح', 'In Salah'), (54, 'عين قزام', 'In Guezzam'), (55, 'تقرت', 'Touggourt'), (56, 'جانت', 'Djanet'),
(57, 'المغير', 'El M''Ghair'), (58, 'المنيعة', 'El Meniaa')
ON CONFLICT (id) DO NOTHING;

-- Apply RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wilayas_stats ENABLE ROW LEVEL SECURITY;

-- Public can read all
CREATE POLICY "Public read campaigns" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Public read partners" ON public.partners FOR SELECT USING (true);
CREATE POLICY "Public read library" ON public.digital_library FOR SELECT USING (true);
CREATE POLICY "Public read wilayas" ON public.wilayas_stats FOR SELECT USING (true);

-- Admin can manage all
CREATE POLICY "Admin manage campaigns" ON public.campaigns FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admin manage partners" ON public.partners FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admin manage library" ON public.digital_library FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admin manage wilayas" ON public.wilayas_stats FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
