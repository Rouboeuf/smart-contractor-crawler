# 🕸️ Smart Contractor Crawler

The **Smart Contractor Crawler** is a fast, concurrent website scraper that extracts **emails, phone numbers, text content, and metadata** from contractor or service business websites.  
It’s designed for **lead generation, business enrichment, and AI training datasets**.

---

## 🚀 What It Does
- Crawls multiple websites simultaneously  
- Collects **homepage + relevant pages** (like “About”, “Contact”, “Services”)  
- Extracts:
  - Company name & title
  - Website URL
  - Emails & phone numbers
  - Visible text and HTML structure
- Outputs clean JSON and CSV-ready datasets

---

## 🧰 Input
Provide one or multiple URLs in the **Start URLs** field.

```json
{
  "startUrls": [
    "https://www.abgbuilds.com",
    "https://www.aboltinc.com",
    "https://www.baystateplumbing.com"
  ]
}
You can add up to 10,000 URLs per run (depending on your Apify plan).

📦 Output
Each dataset item includes:

Field	Description
url	Website URL crawled
title	Page title or company name
emails	Extracted emails
phones	Extracted phone numbers
html	Full HTML of homepage and key pages
text	Combined readable text from the most relevant pages

⚙️ How It Works
Loads the homepage and identifies internal links (About, Services, Contact, etc.)

Extracts visible text, emails, and phones from each relevant page

Cleans, deduplicates, and saves results to the dataset

Exports automatically in JSON, CSV, or Excel format

💡 Use Cases
🧾 Building B2B contractor lead lists

🧠 Collecting industry-specific content for AI training

📈 Enriching CRM or cold outreach systems (HubSpot, GoHighLevel, etc.)

🔍 Automating research for local service providers

💵 Pricing
Simple pay-per-event model:

$0.01 minimum per run

Approx. $0.012 per 10 websites

Double-checked data with ~50% profit margin built in

🧪 Example Output
json
Copy code
{
  "url": "https://www.abgbuilds.com",
  "title": "ABG Builds | General Contracting",
  "emails": ["info@abgbuilds.com"],
  "phones": ["(416) 555-1234"],
  "html": "<html>...</html>",
  "text": "ABG Builds offers general contracting and renovation services in Toronto..."
}
⚠️ Notes
Invalid or parked domains are automatically skipped.

SSL certificate warnings are ignored safely (for non-HTTPS sites).

Use responsibly and respect each website’s robots.txt.

👨‍💻 Author
Louis-Charles Carrier
Freelance automation & AI systems developer
Creator of Smart Contractor Systems

⭐ If you find this tool helpful — star the repo or leave feedback on Apify Store!

yaml
Copy code

---

### ✅ Where to Put It
- Replace your current **README.md** on GitHub with this text.  
- The **“Description”** field in Apify should copy the short intro section (first paragraph).  

---

Would you like me to also generate a short **Apify Store preview text (one paragraph)** that matches this REA
