# 💰 Smart AI Expense Tracker & Financial Manager

A full-stack, AI-powered financial tracking and expense analytics web application built with **React 18, Vite, Express, Tailwind CSS, Google Gemini 2.5 AI, and Razorpay/Stripe integration**.

---

## 🌟 Key Features

- 📸 **Smart AI Receipt Scanner**: Snap or upload receipts and bills. Uses Gemini AI vision model to automatically extract merchant name, date, time, items, tax, and total amount.
- ⚡ **Quick Add & Custom Categories**: Lightning-fast expense logging with quick-amount chips and custom category support.
- 🔍 **Transaction Search & Filtering**: Search through past transactions instantly by merchant name, category, or notes.
- 📊 **Visual Analytics & Category Split**: Interactive pie charts and bar graphs powered by Recharts for monthly budget breakdown.
- 🤖 **AI Financial Assistant**: Get personalized savings advice, expense insights, and budget forecasts.
- 📄 **Export & Report Downloads**: Export expense records into clean CSV or PDF reports.
- 👑 **Pro Member Tier Integration**: Includes payment gateway checkout interface (Razorpay / Stripe) for 2-Month Pro Pass access at ₹99.

---

## 🛠️ Tech Stack & Architecture

### **Frontend**
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (Clean, Modern, Mobile-First Design)
- **Icons**: Lucide React
- **Animations**: Motion / Framer Motion
- **Data Visualization**: Recharts

### **Backend**
- **Runtime**: Node.js + Express (TypeScript)
- **AI Engine**: `@google/genai` (Google Gemini 2.5 Flash API)
- **Payment Gateway**: Integration endpoints for Razorpay and Stripe

---

## 🚀 Getting Started Locally

### **1. Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/smart-expense-tracker.git
cd smart-expense-tracker
```

### **2. Install dependencies**
```bash
npm install
```

### **3. Set up Environment Variables**
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
```

### **4. Start the Development Server**
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 📄 License
MIT License. Created by Shivnath.
