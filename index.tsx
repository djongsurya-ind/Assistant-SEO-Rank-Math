/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';

// --- DOM Element Selection ---
const form = document.getElementById('seo-form') as HTMLFormElement;
const titleInput = document.getElementById('article-title') as HTMLInputElement;
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

    // Topic Strength
    const topicCard = document.createElement('div');
    topicCard.className = 'result-card';
    topicCard.innerHTML = `
        <h3>🧠 Kekuatan Topik</h3>
        <div class="score-display">Skor: <strong>${result.topic_strength_score} / 100</strong></div>
        <p>${result.topic_strength_recommendation}</p>
    `;
    resultsContainer.appendChild(topicCard);

    // Opening Paragraph Rewrite Suggestion (if needed)
    if (result.opening_paragraph_analysis && !result.opening_paragraph_analysis.is_good) {
        const openingCard = document.createElement('div');
        openingCard.className = 'result-card';
        openingCard.innerHTML = `
            <h3>📝 Saran Penulisan Ulang Paragraf Awal</h3>
            <p>Untuk memastikan kata kunci fokus ("<strong>${result.focus_keyword}</strong>") muncul di awal, ganti paragraf pembuka Anda dengan versi yang dioptimalkan ini:</p>
            <blockquote class="suggestion-quote">${result.opening_paragraph_analysis.suggestion}</blockquote>
        `;
        resultsContainer.appendChild(openingCard);
    }

    // Keywords Card
    const allKeywords = [result.focus_keyword, ...result.related_keywords];
    const keywordsString = allKeywords.join(', ');

    const keywordCard = document.createElement('div');
    keywordCard.className = 'result-card';

    const cardTitle = document.createElement('h3');
    cardTitle.textContent = '✨ Rekomendasi Kata Kunci';
    keywordCard.appendChild(cardTitle);

    const keywordContent = document.createElement('div');
    keywordContent.className = 'keyword-content';

    const keywordText = document.createElement('p');
    keywordText.className = 'keyword-text';
    keywordText.textContent = keywordsString;
    keywordContent.appendChild(keywordText);

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Salin';
    copyButton.className = 'copy-btn';
    copyButton.type = 'button';
    copyButton.setAttribute('aria-label', 'Salin kata kunci');
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(keywordsString).then(() => {
            copyButton.textContent = 'Disalin!';
            copyButton.classList.add('copied');
            setTimeout(() => {
                copyButton.textContent = 'Salin';
                copyButton.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy keywords: ', err);
            copyButton.textContent = 'Gagal';
        });
    });
    keywordContent.appendChild(copyButton);

    keywordCard.appendChild(keywordContent);
    resultsContainer.appendChild(keywordCard);


    // Basic SEO
    const basicSeoItems = [
        { text: `Saran Judul SEO: **${result.seo_title}**`, isSuggestion: true },
        { text: `Saran Deskripsi Meta: **${result.meta_description}** (${result.meta_description.length} karakter)`, isSuggestion: true },
        { text: `Saran URL: **${result.url_slug}**`, isSuggestion: true },
    ];
    // Add positive feedback if the paragraph is already good.
    if (result.opening_paragraph_analysis && result.opening_paragraph_analysis.is_good) {
        basicSeoItems.push({ text: result.opening_paragraph_analysis.suggestion, isSuggestion: false });
    }
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    if (wordCount < 600) {
        basicSeoItems.push({ text: `Panjang konten Anda ${wordCount} kata. Pertimbangkan untuk menambahkannya hingga **minimal 600 kata**.`, isSuggestion: true });
    } else {
        basicSeoItems.push({ text: `Panjang konten Anda ${wordCount} kata. Sudah bagus!`, isSuggestion: false });
    }
    resultsContainer.appendChild(createSuggestionCard('✅ Basic SEO', basicSeoItems));

    // Additional SEO
    const additionalSeoCard = document.createElement('div');
    additionalSeoCard.className = 'result-card';
    additionalSeoCard.innerHTML = '<h3>➕ Additional SEO</h3>';
    const additionalSeoList = document.createElement('ul');
    additionalSeoList.className = 'suggestion-list';

    // Subheadings with context
    result.subheadings.forEach((sh: { suggestion: string; placement_reason: string }) => {
        const listItem = document.createElement('li');
        listItem.className = 'suggestion suggestion-complex';
        listItem.innerHTML = `
            Saran Subheading: <strong>${sh.suggestion}</strong>
            <p class="placement-reason"><em>Penempatan:</em> ${sh.placement_reason}</p>
        `;
        additionalSeoList.appendChild(listItem);
    });

    // Other additional SEO items
    const otherItems = [
        { text: `Saran Alt Text Gambar: **${result.image_alt_text}**`, isSuggestion: true },
        { text: result.keyword_density_suggestion, isSuggestion: true },
        { text: `Pastikan Anda menambahkan **link internal** (link ke artikel lain di situs Anda).`, isSuggestion: true },
        { text: `Anda sudah bagus dalam menautkan ke sumber eksternal. Pastikan setidaknya satu bersifat **DoFollow**.`, isSuggestion: false }
    ];

    otherItems.forEach(item => {
        const listItem = document.createElement('li');
        listItem.className = item.isSuggestion ? 'suggestion' : 'good';
        listItem.innerHTML = item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        additionalSeoList.appendChild(listItem);
    });

    additionalSeoCard.appendChild(additionalSeoList);
    resultsContainer.appendChild(additionalSeoCard);


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
        const content = contentInput.value;

        const prompt = `
        Anda adalah seorang ahli SEO kelas dunia yang berspesialisasi dalam optimasi menggunakan plugin Rank Math.
        Tugas Anda adalah menganalisis artikel yang diberikan dan memberikan rekomendasi konkret dan dapat ditindaklanjuti untuk meningkatkan skor SEO-nya.

        Informasi Artikel:
        - Judul Asli: ${title}
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
            - PENTING: Hindari penggunaan simbol '&', selalu gunakan kata 'dan' sebagai gantinya.

        2.  "meta_description": Buat meta description baru yang menarik untuk diklik. Ini WAJIB dan TIDAK BOLEH lebih dari 160 karakter. Harus mengandung Kata Kunci Fokus.

        3.  "url_slug": Sarankan slug URL baru yang singkat dan mengandung Kata Kunci Fokus.

        4.  "subheadings": Berikan array berisi 2 objek saran subheading (H2 atau H3). Setiap objek harus memiliki "suggestion" (teks subheading baru yang relevan dan mengandung Kata Kunci Fokus) dan "placement_reason" (penjelasan singkat di mana subheading ini harus ditempatkan, misalnya: "Ganti subheading 'Tentang Topik X' dengan ini untuk penekanan yang lebih kuat.").

        5.  "image_alt_text": Sarankan satu teks alt untuk gambar yang relevan dengan artikel dan mengandung Kata Kunci Fokus.

        6.  "opening_paragraph_analysis": Analisis paragraf pembuka artikel (sekitar 10% pertama). Kembalikan objek dengan dua kunci: "is_good" (boolean: true jika Kata Kunci Fokus sudah ada dan ditempatkan dengan baik, false jika tidak) dan "suggestion" (string: jika is_good adalah false, berikan paragraf pembuka yang DI TULIS ULANG SEPENUHNYA. Jika is_good adalah true, berikan pujian singkat seperti 'Paragraf pembuka sudah bagus dan mengandung kata kunci fokus!').

        7.  "keyword_density_suggestion": Berikan saran singkat dan actionable tentang kepadatan kata kunci. Misalnya, "Kepadatan kata kunci terlihat rendah. Coba tambahkan kata kunci fokus 2-3 kali lagi secara alami di dalam konten."

        Langkah 3: Analisis Kekuatan Topik
        Berdasarkan konten yang diberikan, analisis kedalaman dan fokus pembahasannya. Berikan skor dari 1-100 pada "topic_strength_score" yang merepresentasikan seberapa komprehensif artikel ini. Kemudian, berikan satu paragraf "topic_strength_recommendation" yang berisi saran konkret tentang cara membuat konten lebih mendalam, detail, dan fokus pada topik utamanya untuk memuaskan search intent pengguna.
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
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        suggestion: { type: Type.STRING },
                                        placement_reason: { type: Type.STRING },
                                    },
                                    required: ['suggestion', 'placement_reason']
                                },
                            },
                            image_alt_text: { type: Type.STRING },
                            opening_paragraph_analysis: {
                                type: Type.OBJECT,
                                properties: {
                                    is_good: { type: Type.BOOLEAN },
                                    suggestion: { type: Type.STRING },
                                },
                                required: ['is_good', 'suggestion']
                            },
                            keyword_density_suggestion: { type: Type.STRING },
                            topic_strength_score: { type: Type.NUMBER },
                            topic_strength_recommendation: { type: Type.STRING },
                        },
                        required: ['focus_keyword', 'related_keywords', 'seo_title', 'meta_description', 'url_slug', 'subheadings', 'image_alt_text', 'opening_paragraph_analysis', 'keyword_density_suggestion', 'topic_strength_score', 'topic_strength_recommendation'],
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
