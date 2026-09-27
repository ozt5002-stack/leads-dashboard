# Leads Dashboard

דאשבורד לידים (React + Recharts) שמסונכרן עם Airtable, עם טאב נוסף של מחקר שוק שהנתונים שלו מגיעים מ-Apify.

אתר חי: https://ozt5002-stack.github.io/leads-dashboard

## טאב Market Research: נתונים מ-Apify

השאלה שהטאב עונה עליה: **איפה חשמלאים נתקעים?** כלומר, על אילו נושאים שואלים בפורומים מקצועיים ולא מקבלים תשובה, ומי המתחרים.

| מקור | מה נאסף | למה |
|---|---|---|
| [arielsegal.co.il](https://arielsegal.co.il/topics/) (פורום חשמל) | שאלות: כותרת, מחבר, מספר תגובות, פעילות אחרונה | ביקוש: אילו בעיות חוזרות, ואילו נשארות בלי מענה |
| [pro.co.il/electricians](https://www.pro.co.il/electricians) | חשמלאים: שם, דירוג, מספר ביקורות | מתחרים |

**איך זה עובד:**

1. **Apify** מריץ את ה-Actor `apify/cheerio-scraper` עם `pageFunction` משלנו, שנמצא ב-`src/scraperCore.js`.
2. כל שאלה מקבלת **נושא** לפי מילות מפתח (סולארי, ממסר פחת, הארקה, לוח וכו').
3. התוצאות נשמרות בטבלת **Forum Leads** ב-Airtable. השמירה היא upsert לפי הקישור: הרצה חוזרת מעדכנת שורות קיימות במקום ליצור כפולות, ולא דורסת את הסטטוס שנבחר ידנית.
4. הטאב מציג:
   - כרטיסים: כמה שאלות יש, כמה מהן בלי תשובה מעל שבוע, כמה מתחרים ומה הדירוג הממוצע שלהם.
   - גרף שאלות לפי נושא: בלי תשובה מעל שבוע / חדשה / נענתה.
   - טבלה עם סינון וסטטוס שנשמר ב-Airtable.

**שתי דרכים להפעיל את הסריקה:**

- **מהדשבורד:** כפתור "הרץ סריקה". הדפדפן פונה ישירות ל-Apify API. הטוקנים של Apify ו-Airtable נשמרים ב-localStorage בלבד, לא בקוד.
- **אוטומטית, דרך GitHub Actions:** `.github/workflows/scrape.yml` רץ כל בוקר, ואפשר להפעיל אותו גם ידנית ב-Actions ← Scrape Forum Leads ← Run workflow. הוא מריץ את `scripts/scrape.mjs` עם הטוקנים מ-GitHub Secrets (`APIFY_TOKEN`, `AIRTABLE_TOKEN`). הדרך הזו עובדת גם ברשת שחוסמת את `api.apify.com`.

## טאב סולארי: נתונים מ-PVGIS (בבנייה)

מקור חיצוני שני: [PVGIS](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/getting-started-pvgis/api-non-interactive-service_en), ה-API הציבורי של הנציבות האירופית. הוא מחשב כמה חשמל תייצר מערכת סולארית בכל מיקום. חינם ובלי טוקן.

- **למה דרך GitHub Actions:** PVGIS חוסם קריאות ישירות מהדפדפן (CORS). לכן `.github/workflows/solar.yml` מריץ את `scripts/solar.mjs`, שפונה ל-PVGIS עבור 8 ערים ושומר ב-Airtable, בטבלה **Solar Estimates** (upsert לפי עיר).
- **למה 1 kWp:** הייצור עולה ביחס ישר לגודל המערכת. לכן שומרים את הייצור של 1 kWp לכל עיר, והדשבורד מכפיל בגודל שהמשתמש בוחר, בלי קריאה נוספת ל-API.
- הנתונים: ייצור לכל חודש ולשנה, וזווית וכיוון אופטימליים שחישב PVGIS. הלוגיקה נמצאת ב-`src/solarCore.js`.

## קבצים

- `index.html`: הדשבורד שמתפרסם ל-GitHub Pages. React ו-Recharts נטענים מ-CDN.
- `src/`: אותו קוד כפרויקט Vite. `scraperCore.js` משותף לדשבורד ולסקריפט של GitHub Actions.
- `scripts/scrape.mjs`: הסריקה המתוזמנת.
- `scripts/solar.mjs`, `src/solarCore.js`: נתוני PVGIS.
