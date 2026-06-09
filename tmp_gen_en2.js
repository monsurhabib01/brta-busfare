const fs = require('fs');
const content = fs.readFileSync('script.js', 'utf8');

// Get all unique locations
const fromRe = /"from":\s*"([^"]+)"/g;
const toRe = /"to":\s*"([^"]+)"/g;
const locs = new Set();
let m;
while ((m = fromRe.exec(content)) !== null) locs.add(m[1]);
while ((m = toRe.exec(content)) !== null) locs.add(m[1]);

// Standard English names
const enNames = {
    'আমতলী': 'Amtali',
    'আলফাডাঙ্গা': 'Alfadanga',
    'ইশ্বরদী': 'Ishwardi',
    'উলিপুর': 'Ulipur',
    'কক্সবাজার': "Cox's Bazar",
    'কচুয়া': 'Kachua',
    'কটিয়াদি': 'Katiyadi',
    'কানকিরহাট': 'Kankirhat',
    'কানকিরহাট (নোয়াখালী)': 'Kankirhat (Noakhali)',
    'কানাচুয়া (কুমিল্লা)': 'Kanachua (Cumilla)',
    'কাপ্তাই': 'Kaptai',
    'কালিগঞ্জ': 'Kaliganj',
    'কালিগঞ্জ (সাতক্ষীরা)': 'Kaliganj (Satkhira)',
    'কিশোরগঞ্জ': 'Kishoreganj',
    'কুটি কসবা': 'Kuti Kasba',
    'কুটি চৌমুহনী': 'Kuti Chowmuhoni',
    'কুমিল্লা': 'Cumilla',
    'কুলাউড়া': 'Kulaura',
    'কুষ্টিয়া': 'Kushtia',
    'কুড়িগ্রাম': 'Kurigram',
    'কুয়াকাটা': 'Kuakata',
    'কেন্দুয়া': 'Kendua',
    'কেন্দুয়া বাজার': 'Kendua Bazar',
    'কেশরগঞ্জ': 'Keshorganj',
    'কোম্পানীগঞ্জ': 'Companyganj',
    'খাগড়াছড়ি': 'Khagrachhari',
    'খুলনা': 'Khulna',
    'গফরগাঁও': 'Gafargaon',
    'গাইবান্ধা': 'Gaibandha',
    'গাজীপুর': 'Gazipur',
    'গাজীপুর (চৌরাস্তা)': 'Gazipur (Chourasta)',
    'গাজীপুর (জয়দেবপুর)': 'Gazipur (Joydebpur)',
    'গাজীপুর (শিববাড়ী)': 'Gazipur (Shibbari)',
    'গাবতলী': 'Gabtali',
    'গোপালগঞ্জ': 'Gopalganj',
    'গোপালপুর': 'Gopalpur',
    'গৌরীপুর': 'Gauripur',
    'চট্টগ্রাম': 'Chattogram',
    'চট্রগাম': 'Chattogram',
    'চট্রগ্রাম': 'Chattogram',
    'চরফ্যাশন': 'Char Fasson',
    'চাঁদপুর': 'Chandpur',
    'চাঁপাইনবাবগঞ্জ': 'Chapainawabganj',
    'চাটখিল': 'Chatkhil',
    'চামড়া বন্দর': 'Chamra Bander',
    'চিতোষী': 'Chitohi',
    'চিলমারী': 'Chilmari',
    'চুয়াডাঙ্গা': 'Chuadanga',
    'চৌদ্দগ্রাম': 'Chauddagram',
    'ছাগলনাইয়া': 'Chhagalnaiya',
    'ছাতক': 'Chhatak',
    'জকিগঞ্জ': 'Zakiganj',
    'জগন্নাথপুর': 'Jagannathpur',
    'জাফলং': 'Jafflong',
    'জামালপুর': 'Jamalpur',
    'জীবনণগর (চুয়াডাঙ্গা)': 'Jibannagar (Chuadanga)',
    'জয়পুরহাট': 'Joypurhat',
    'ঝালকাঠি': 'Jhalokathi',
    'ঝিনাইদহ': 'Jhenaidah',
    'টাঙ্গাইল': 'Tangail',
    'টেকনাফ': 'Teknaf',
    'ঠাকুরগাঁও': 'Thakurgaon',
    'ঢাকা (গাবতলী)': 'Dhaka (Gabtali)',
    'ঢাকা (মহাখালী)': 'Dhaka (Mohakhali)',
    'ঢাকা (সাভার ইপিজেড)': 'Dhaka (Savar EPZ)',
    'ঢাকা (সায়দাবাদ)': 'Dhaka (Saydabad)',
    'ঢাকা (সায়েদাবাদ)': 'Dhaka (Saydabad)',
    'ঢাকা(গাবতলী)': 'Dhaka (Gabtali)',
    'ঢাকা(মহাখালী)': 'Dhaka (Mohakhali)',
    'ঢাকা(সায়দাবাদ)': 'Dhaka (Saydabad)',
    'তবলছড়ী': 'Tabalchhari',
    'তারাকান্দা': 'Tarakhanda',
    'তারাকান্দি': 'Tarakandi',
    'দর্শনা': 'Darshana',
    'দিঘীনালা': 'Dighinala',
    'দিঘীরপাড়': 'Dighirpar',
    'দিনাজপুর': 'Dinajpur',
    'দেবীগঞ্জ': 'Debiganj',
    'দেলদুয়ার': 'Delduar',
    'ধর্মপাশা (কুড়িগ্রাম)': 'Dharmapasha (Kurigram)',
    'নওগাঁ': 'Naogaon',
    'নবাবপুর': 'Nababpur',
    'নবীনগর': 'Nobiganj',
    'নবীনগর (ব্রাহ্মণবাড়িয়া)': 'Nobiganj (Brahmanbaria)',
    'নরসিংদী': 'Narsingdi',
    'নরসিংদী (ইটাখোলা)': 'Narsingdi (Itakhola)',
    'নাগরপুর': 'Nagarpur',
    'নাঙ্গলকোর্ট': 'Nangalkot',
    'নাজিরপুর': 'Nazirpur',
    'নাটোর': 'Natore',
    'নান্দিনা': 'Nandina',
    'নারায়নগঞ্জ': 'Narayanganj',
    'নালিতাবাড়ী': 'Nalitabari',
    'নীলফামারী': 'Nilphamari',
    'নেত্রকোনা': 'Netrokona',
    'নড়াইল': 'Narail',
    'পঞ্চগড়': 'Panchagarh',
    'পটুয়াখালী': 'Patuakhali',
    'পরশুরাম': 'Parshuram',
    'পাকুন্দিয়া': 'Pakundia',
    'পাটগ্রাম': 'Patgram',
    'পাথরঘাটা': 'Patharghata',
    'পানছড়ী': 'Panchhari',
    'পাবনা': 'Pabna',
    'পিরোজপুর': 'Pirojpur',
    'প্রাগপুর (কুষ্টিয়া)': 'Pragpur (Kushtia)',
    'ফরিদগঞ্জ': 'Faridganj',
    'ফরিদপুর': 'Faridpur',
    'ফুলবাড়ীয়া': 'Fulbaria',
    'ফেঞ্চুগঞ্জ': 'Fenchuganj',
    'ফেনী': 'Feni',
    'বগুড়া': 'Bogura',
    'বরগুনা': 'Barguna',
    'বরিশাল': 'Barishal',
    'বরুড়া': 'Barura',
    'বসুরহাট': 'Basurhat',
    'বাউফল': 'Bauphal',
    'বাগেরহাট': 'Bagerhat',
    'বান্দরবান': 'Bandarban',
    'বিয়ানী বাজার': 'Biyani Bazar',
    'বিয়ানীবাজার': 'Bianibazar',
    'বিয়ানীবাজার (সিলেট)': 'Bianibazar (Sylhet)',
    'বুড়িচং': 'Burichang',
    'বুড়িমারী': 'Burimari',
    'বেগমগঞ্জ': 'Begumganj',
    'বেনাপোল': 'Benapole',
    'বেনাপোাল': 'Benapole',
    'ব্রাম্মনপাড়া': 'Brammanpara',
    'ব্রাহ্মণবাড়িয়া': 'Brahmanbaria',
    'ব্রাহ্মণবাড়িয়া': 'Brahmanbaria',
    'ব্রাহ্মণবাড়িয়া': 'Brahmanbaria',
    'বড়লেখা': 'Barlekha',
    'ভায়া-': 'via-',
    'ভুয়াপুর': 'Bhuapur',
    'ভূরুঙ্গামারী': 'Bhurungamari',
    'ভৈরব': 'Bhairab',
    'মতলব (চাঁদপুর)': 'Matlab (Chandpur)',
    'মনোহরদী': 'Manohardi',
    'মাইজদী': 'Maijdee',
    'মাইজদী (নোয়াখালী)': 'Maijdee (Noakhali)',
    'মাওয়া ঘাট': 'Mawa Ghat',
    'মাগুরা': 'Magura',
    'মাগুড়া': 'Magura',
    'মাদারীপুর': 'Madaripur',
    'মুক্তাগাছা': 'Muktagachha',
    'মুক্তারপুর': 'Muktarpur',
    'মুজিবনগর': 'Mujibnagar',
    'মুন্সীগঞ্জ': 'Munshiganj',
    'মুরাদনগর': 'Muradnagar',
    'মেঘনা উপজেলা (কুমিল্লা)': 'Meghna Upazila (Cumilla)',
    'মেহেরপুর': 'Meherpur',
    'মোংলা': 'Mongla',
    'মোংলা (বাগেরহাট)': 'Mongla (Bagerhat)',
    'মোকসেদপুর': 'Moksedpur',
    'মৌলভীবাজার': 'Moulvibazar',
    'ময়মনসিংহ': 'Mymensingh',
    'যশোর': 'Jashore',
    'রংপুর': 'Rangpur',
    'রাঙ্গামাটি': 'Rangamati',
    'রাজবাড়ী': 'Rajbari',
    'রাজশাহী': 'Rajshahi',
    'রামগঞ্জ': 'Ramganj',
    'রামগতি': 'Ramgati',
    'রামগড়': 'Ramgarh',
    'রায়পুর': 'Raypur',
    'রৌমারী (কুড়িগ্রাম)': 'Roumari (Kurigram)',
    'লক্ষীপাশা': 'Lakshhipasha',
    'লক্ষীপাশা(লোহাগড়া)': 'Lakshhipasha (Lohagara)',
    'লক্ষ্মীপুর': 'Lakshmipur',
    'লাকসাম': 'Laksham',
    'লালমনিরহাট': 'Lalmonirhat',
    'লাহুরিয়া (নড়াইল)': 'Lahuria (Narail)',
    'শরিয়তপুর': 'Shariatpur',
    'শাহরাস্তি (চাঁদপুর': 'Shahrasti (Chandpur)',
    'শিবগঞ্জ': 'Shibganj',
    'শেরপুর': 'Sherpur',
    'সখিপুর': 'Sakhipur',
    'সরিষাবাড়ী': 'Sarishabari',
    'সাগরদিঘী': 'Sagardighi',
    'সাতক্ষীরা': 'Satkhira',
    'সিরাজগঞ্জ': 'Sirajganj',
    'সিলেট': 'Sylhet',
    'সুনামগঞ্জ': 'Sunamganj',
    'সৈয়দপুর': 'Syedpur',
    'সোনাগাজী': 'Sonagazi',
    'সোনাপুর': 'Sonapur',
    'হবিগঞ্জ': 'Habiganj',
    'হাজীগঞ্জ': 'Hajiganj',
    'হালুয়াঘাট': 'Haluaghat',
    'হিজলা': 'Hijla',
    'হিলি': 'Hilli',
    'হোমনা (কুমিল্লা)': 'Homna (Cumilla)',
    'হোসেনপুর (কিশোরগঞ্জ)': 'Hossainpur (Kishoreganj)',
    'হোসেনপুর (চাঁদপুর)': 'Hossainpur (Chandpur)',
};

// Manual translations for complex via descriptions
const manualTranslations = {
    'কুয়াকাটা ভায়া-জয়দেবপুর চৌরাস্তা, টঙ্গী, কুড়িল বিশ্বরোড, সায়দাবাদ, পদ্মা বহুমুখী সেতু, ভাঙ্গা, মাদারীপুর, বরিশাল, পটুয়াখালী': 'Kuakata via Joydebpur Chourasta, Tongi, Kuril Bishworoad, Saydabad, Padma Multipurpose Bridge, Bhanga, Madaripur, Barishal, Patuakhali',
    'খুলনা ভায়া-কাঁচপুর ব্রিজ, ঢাকার (পোস্তগোলা ব্রিজ), পদ্মা বহুমুখী সেতু, ভাঙ্গা, গোপালগঞ্জ, মোল্লাহাট, ফকিরহাট': 'Khulna via Kanchpur Bridge, Dhaka (Postogola Bridge), Padma Multipurpose Bridge, Bhanga, Gopalganj, Mollahat, Fakirhat',
    'খুলনা ভায়া-জয়দেবপুর চৌরাস্তা, টঙ্গী, ‍কুড়িল বিশ্বরোড, সায়দাবাদ, পদ্মা বহুমুখী সেতু, ভাঙ্গা, গোপালগঞ্জ': 'Khulna via Joydebpur Chourasta, Tongi, Kuril Bishworoad, Saydabad, Padma Multipurpose Bridge, Bhanga, Gopalganj',
    'নোয়াখালী ভায়া-ব্রাহ্মণবাড়িয়া, কুমিল্লা, লাকসাম, চৌমুহনী': 'Noakhali via Brahmanbaria, Cumilla, Laksham, Chowmuhoni',
    'বেনাপোল ভায়া-চট্টগ্রাম, ফেনী, কুমিল্লা, ঢাকা (পোস্তগোলা ব্রিজ), পদ্মা বহুমুখী সেতু, ভাঙ্গা, মধুমতি সেতু, নড়াইল, যশোর': 'Benapole via Chattogram, Feni, Cumilla, Dhaka (Postogola Bridge), Padma Multipurpose Bridge, Bhanga, Madhumati Bridge, Narail, Jashore',
    'বেনাপোল ভায়া-ফেনী, কুমিল্লা, ঢাকা (পোস্তগোলা ব্রিজ), পদ্মা বহুমুখী সেতু, ভাঙ্গা, ফরিদপুর, মাগুরা, আড়পাড়া, যশোর': 'Benapole via Feni, Cumilla, Dhaka (Postogola Bridge), Padma Multipurpose Bridge, Bhanga, Faridpur, Magura, Arpara, Jashore',
    'রংপুর, ফেনী, কুমিল্লা, মদনপুর, গাউছিয়া, গাজীপুর বাইপাস, চন্দ্রা, টাঙ্গাইল, যমুনা সেতু, হাটিকুমরুল, বগুড়া': 'Rangpur, Feni, Cumilla, Modonpur, Goushia, Gazipur Bypass, Chandra, Tangail, Jamuna Bridge, Hatikumrul, Bogura',
    'ভায়া-': 'via-',
};

// Build sorted output
const sorted = Array.from(locs).sort();
const lines = [];
sorted.forEach(loc => {
    let en;
    if (manualTranslations[loc]) {
        en = manualTranslations[loc];
    } else if (enNames[loc]) {
        en = enNames[loc];
    } else {
        // Fallback - try to translate via description
        en = loc;
        // Replace Bengali location names with English
        for (const [bn, eng] of Object.entries(enNames)) {
            if (en.includes(bn)) {
                en = en.replace(new RegExp(bn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), eng);
            }
        }
        // Remove variat ion selector and other invisible chars
        en = en.replace(/[\u200C\u200D\uFE00-\uFE0F]/g, '');
        // Replace common terms
        const terms = {
            'বাইপাস': 'Bypass', 'ব্রিজ': 'Bridge', 'সেতু': 'Bridge',
            'ফেরি ঘাট': 'Ferry Ghat', 'ফেরি': 'Ferry',
            'মোড়': 'Mor', 'বাজার': 'Bazar', 'ঘাট': 'Ghat',
            'সড়ক': 'Road', 'ভায়া': 'via', 'বহুমুখী': 'Multipurpose',
            'সেতু': 'Bridge', 'উপজেলা': 'Upazila',
            'বিশ্বরোড': 'Bishworoad', 'চৌরাস্তা': 'Chourasta',
            'ঢাকার': 'Dhaka',
        };
        for (const [bnTerm, enTerm] of Object.entries(terms)) {
            en = en.split(bnTerm).join(enTerm);
        }
        en = en.replace(/\s+/g, ' ').trim();
        en = en.replace(/,?\s*$/, '');
    }
    lines.push(`    '${loc}': '${en.replace(/'/g, "\\'")}',`);
});

console.log(lines.join('\n'));
