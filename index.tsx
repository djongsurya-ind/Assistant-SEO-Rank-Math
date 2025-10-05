/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';

// --- DOM Element Selection ---
const form = document.getElementById('seo-form') as HTMLFormElement;
const titleInput = document.getElementById('article-title') as HTMLInputElement;
const permalinkInput = document.getElementById('article-permalink') as HTMLInputElement;
const contentInput = document.getElementById('article-content') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resultsContainer = document.getElementById('results-container') as HTMLElement;
const errorContainer = document.getElementById('error-container') as HTMLDivElement;

// --- State Management ---
let isLoading = false;

function setLoading(loading: boolean) {
    isLoading = loading;
    generateBtn.disabled = loading;
    generateBtn.textContent = loading ? 'Membuat Rekomendasi...' : 'Buat Rekomendasi SEO';
    if (loading) {
        resultsContainer.classList.add('hidden');
        errorContainer.classList.add('hidden');
        resultsContainer.innerHTML = '<h2>Rekomendasi Optimasi</h2>'; // Reset on new generation
    }
}

function displayError(message: string) {
    errorContainer.textContent = `Error: ${message}`;
    errorContainer.classList.remove('hidden');
}

// --- UI Display Functions ---
function createSuggestionCard(title: string, items: { text: string; isSuggestion: boolean }[]) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const cardTitle = document.createElement('h3');
    cardTitle.textContent = title;
    card.appendChild(cardTitle);

    const list = document.createElement('ul');
    list.className = 'suggestion-list';

    items.forEach(item => {
        if (!item.text) return;
        const listItem = document.createElement('li');
        listItem.className = item.isSuggestion ? 'suggestion' : 'good';
        // Simple HTML parsing for bold tags
        listItem.innerHTML = item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        list.appendChild(listItem);
    });

    card.appendChild(list);
    return card;
}


function displayResults(result: any, content: string) {
    resultsContainer.innerHTML = '<h2>Rekomendasi Optimasi</h2>'; // Clear previous results

    // Keywords Card
    const keywordItems = [
        { text: `Kata Kunci Fokus Utama: **${result.focus_keyword}**`, isSuggestion: false },
        ...result.related_keywords.map((kw: string) => ({ text: kw, isSuggestion: false })),
    ].map(item => ({ ...item, text: item.text.replace(result.focus_keyword, `<strong>${result.focus_keyword}</strong>`) }));
    const keywordCard = createSuggestionCard('✨ Rekomendasi Kata Kunci', keywordItems);
    // Remove the bullet points for the keyword card for a cleaner look
    keywordCard.querySelectorAll('li').forEach(li => {
        li.classList.add('good');
        li.style.listStyle = 'none';
        li.style.paddingLeft = '0';
    });
    keywordCard.querySelector('li')?.classList.remove('good'); // remove icon from first item
    resultsContainer.appendChild(keywordCard);


    // Basic SEO
    const basicSeoItems = [
        { text: `Saran Judul SEO: **${result.seo_title}**`, isSuggestion: true },
        { text: `Saran Deskripsi Meta: **${result.meta_description}** (${result.meta_description.length} karakter)`, isSuggestion: true },
        { text: `Saran URL: **${result.url_slug}**`, isSuggestion: true },
        { text: result.opening_paragraph_suggestion, isSuggestion: !!result.opening_paragraph_suggestion && !result.opening_paragraph_suggestion.includes("Kerja bagus") },
    ];
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    if (wordCount < 600) {
        basicSeoItems.push({ text: `Panjang konten Anda ${wordCount} kata. Pertimbangkan untuk menambahkannya hingga **minimal 600 kata**.`, isSuggestion: true });
    } else {
        basicSeoItems.push({ text: `Panjang konten Anda ${wordCount} kata. Sudah bagus!`, isSuggestion: false });
    }
    resultsContainer.appendChild(createSuggestionCard('✅ Basic SEO', basicSeoItems));

    // Additional SEO
    const additionalSeoItems = [
        ...result.subheadings.map((sh: string) => ({ text: `Saran Subheading: **${sh}**`, isSuggestion: true })),
        { text: `Saran Alt Text Gambar: **${result.image_alt_text}**`, isSuggestion: true },
        { text: result.keyword_density_suggestion, isSuggestion: true },
        { text: `Pastikan Anda menambahkan **link internal** (link ke artikel lain di situs Anda).`, isSuggestion: true },
        { text: `Anda sudah bagus dalam menautkan ke sumber eksternal. Pastikan setidaknya satu bersifat **DoFollow**.`, isSuggestion: false }
    ];
    resultsContainer.appendChild(createSuggestionCard('➕ Additional SEO', additionalSeoItems));

    // Title Readability
    const titleReadabilityItems = [
        { text: `Kata kunci fokus muncul di **awal judul SEO**.`, isSuggestion: false },
        { text: `Judul yang disarankan sudah mengandung **sentimen, power word, atau angka** untuk meningkatkan CTR.`, isSuggestion: false }
    ];
    resultsContainer.appendChild(createSuggestionCard('⭐ Title Readability', titleReadabilityItems));

    resultsContainer.classList.remove('hidden');
}

// --- Gemini API Initialization and Call ---
try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isLoading) return;

        setLoading(true);

        const title = titleInput.value;
        const permalink = permalinkInput.value;
        const content = contentInput.value;

        const prompt = `
        Anda adalah seorang ahli SEO kelas dunia yang berspesialisasi dalam optimasi menggunakan plugin Rank Math.
        Tugas Anda adalah menganalisis artikel yang diberikan dan memberikan rekomendasi konkret untuk meningkatkan skor SEO-nya.

        Informasi Artikel:
        - Judul Asli: ${title}
        - Permalink Asli: ${permalink}
        - Isi Artikel: ${content}

        Langkah 1: Identifikasi Kata Kunci
        Pertama, analisis judul dan konten untuk mengidentifikasi satu **"focus_keyword"** (Kata Kunci Fokus) utama yang paling ideal.
        Kemudian, berikan 4 **"related_keywords"** (campuran short-tail dan long-tail) yang relevan.

        Langkah 2: Berikan Rekomendasi Berbasis Kata Kunci Fokus
        Gunakan "focus_keyword" yang telah Anda identifikasi untuk memberikan rekomendasi dalam format JSON yang ketat untuk poin-poin berikut:

        1.  "seo_title": Buat judul SEO baru yang optimal (kurang dari 60 karakter) yang:
            - Memasukkan Kata Kunci Fokus di awal.
            - Mengandung 'power word' (contoh: 'Panduan', 'Terbaik', 'Lengkap', 'Mudah').
            - Mengandung angka (jika relevan).
            - Memiliki sentimen positif atau negatif yang jelas.

        2.  "meta_description": Buat meta description baru yang menarik untuk diklik. Ini WAJIB dan TIDAK BOLEH lebih dari 160 karakter. Harus mengandung Kata Kunci Fokus.

        3.  "url_slug": Sarankan slug URL baru yang singkat dan mengandung Kata Kunci Fokus.

        4.  "subheadings": Berikan array berisi 2 saran subheading (H2 atau H3) yang mengandung Kata Kunci Fokus secara alami.

        5.  "image_alt_text": Sarankan satu teks alt untuk gambar yang relevan dengan artikel dan mengandung Kata Kunci Fokus.

        6.  "opening_paragraph_suggestion": Analisis 10% pertama dari isi artikel. Jika Kata Kunci Fokus tidak ada, berikan saran satu kalimat untuk ditambahkan di awal yang mengandung Kata Kunci Fokus. Jika sudah ada, berikan string "Kata kunci fokus sudah ada di awal konten. Kerja bagus!".

        7.  "keyword_density_suggestion": Berikan saran singkat dan actionable tentang kepadatan kata kunci. Misalnya, "Kepadatan kata kunci terlihat rendah. Coba tambahkan kata kunci fokus 2-3 kali lagi secara alami di dalam konten."
        `;

        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            focus_keyword: { type: Type.STRING },
                            related_keywords: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                            },
                            seo_title: { type: Type.STRING },
                            meta_description: { type: Type.STRING },
                            url_slug: { type: Type.STRING },
                            subheadings: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                            },
                            image_alt_text: { type: Type.STRING },
                            opening_paragraph_suggestion: { type: Type.STRING },
                            keyword_density_suggestion: { type: Type.STRING },
                        },
                        required: ['focus_keyword', 'related_keywords', 'seo_title', 'meta_description', 'url_slug', 'subheadings', 'image_alt_text', 'opening_paragraph_suggestion', 'keyword_density_suggestion'],
                    },
                },
            });

            const responseText = response.text.trim();
            const result = JSON.parse(responseText);

            // Fail-safe: Pastikan deskripsi meta tidak melebihi 160 karakter.
            if (result.meta_description.length > 160) {
                let truncatedDesc = result.meta_description.substring(0, 160);
                // Hindari memotong kata di tengah
                truncatedDesc = truncatedDesc.substring(0, Math.min(truncatedDesc.length, truncatedDesc.lastIndexOf(" ")));
                result.meta_description = truncatedDesc + '...';
            }

            displayResults(result, content);

        } catch (err) {
            console.error(err);
            displayError(err instanceof Error ? err.message : "Terjadi kesalahan yang tidak diketahui.");
        } finally {
            setLoading(false);
        }
    });
} catch (e) {
    console.error(e);
    displayError("Tidak dapat menginisialisasi aplikasi. Apakah kunci API sudah diatur dengan benar?");
    generateBtn.disabled = true;
}