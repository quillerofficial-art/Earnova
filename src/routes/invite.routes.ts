import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  // Disable caching completely
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const token = (req.query.token as string) || '';
  const apkUrl = process.env.APK_DOWNLOAD_URL || 'https://plusone-backend-hhs1.onrender.com/plusone.apk';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes, viewport-fit=cover">
  <title>PlusOne — Elevate Your Essence</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', sans-serif;
      background: #f5f7fc;
      display: flex;
      justify-content: center;
    }
    .phone-container {
      max-width: 500px;
      width: 100%;
      background: white;
      box-shadow: 0 0 30px rgba(0,0,0,0.05);
      margin: 0 auto;
      position: relative;
    }
    .status-bar {
      display: flex;
      justify-content: space-between;
      padding: 12px 20px 6px;
      font-size: 14px;
      font-weight: 500;
      background: white;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 20px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo .plus {
      color: black;
    }
    .logo .one {
      color: blue;
    }
    .logo {
     font-style: italic;
    }
    
    .logo img {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      object-fit: cover;
    }
    .logo span {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .logo span:first-child { color: black; }
    .logo span:last-child { color: #2b59ea; }
    .menu {
      font-size: 24px;
      cursor: default;
    }
    /* ------- NEW HERO SECTION (exactly like second image) ------- */
    .hero {
      padding: 20px 20px 0;
      margin-bottom: 70px;
    }
    .premium-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #eef2ff;
      color: #2b59ea;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 30px;
      margin-bottom: 18px;
      letter-spacing: 0.5px;
    }
    .hero h1 {
      font-size: 36px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -1px;
      color: #0b1220;
    }
    .hero h1 span {
      display: block;
      color: #2b59ea;
      font-style: italic;
    }
    .hero-desc {
      color: #6b7280;
      font-size: 15px;
      margin: 16px 0 22px;
      line-height: 1.6;
    }
    .ref-box {
      background: #f1f3f8;
      border-radius: 40px;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .ref-label {
      font-size: 12px;
      font-weight: 700;
      color: #9aa0ae;
      letter-spacing: 1px;
    }

    .ref-code {
      font-weight: 800;
      font-size: 14px;
      color: #2b59ea;
      word-break: break-all;      /* ✅ FIX: token टूटेगा, बाहर नहीं जाएगा */
      text-align: right;
      max-width: 70%;
      cursor: pointer;
    }
    .ref-code:hover {
      background: #eef2ff;
    }
    .download-btn {
      background: linear-gradient(135deg, #3b5bff, #2b59ea);
      width: 100%;
      border: none;
      padding: 16px;
      border-radius: 20px;
      color: white;
      font-weight: 700;
      font-size: 16px;
      margin-bottom: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 8px 20px rgba(43,89,234,.25);
    }
    .download-btn:hover {
      background: #1e45c4;
      transform: scale(0.98);
    }
    .brands {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      color: #8e8fa3;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .phone-mock {
      width: 100%;
      border-radius: 28px;
      margin-top: 8px;
      box-shadow: 0 12px 24px rgba(0,0,0,0.1);
    }
    .feature-card {
      margin: 40px 0px 70px; /* TOP | SIDE | BOTTOM */
      padding: 50px 40px;
      border-radius: 0px;
      background: radial-gradient(circle at center, #140000 0%, #000000 80%);
      text-align: center;
      color: white;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    }

/* LOGO GLOW EFFECT */
    .feature-logo-wrap {
      width: 120px;
      height: 120px;
      margin: 0 auto 20px;
      border-radius: 50%;
      background: radial-gradient(circle, #1a0000, #000);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 40px rgba(255, 0, 0, 0.2);
    }

    .feature-logo-wrap img {
      width: 90px;
      height: 90px;
      border-radius: 50%;
    }

    /* TITLE */
    .feature-title {
      font-size: 22px;
      font-weight: 800;
      font-style: italic;
      line-height: 1.4;
      margin-bottom: 14px;
    }

    /* DESC */
    .feature-desc {
      font-size: 14px;
      color: #9ca3af;
      line-height: 1.6;
      margin-bottom: 30px;
      padding: 0 10px;
    }

     /* STATS */
    .feature-stats {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .stat {
     flex: 1;
    }

     .stat h4 {
      font-size: 22px;
      font-weight: 800;
    }

    .stat span {
     font-size: 11px;
     color: #9ca3af;
     letter-spacing: 1px;
    }

     /* DIVIDER */
    .divider {
      width: 1px;
      height: 40px;
      background: rgba(255,255,255,0.15);
    }
  
    .steps {
      padding: 0px 20px 30px;
      text-align: center;
    }
    .steps h3 {
      font-size: 32px;
      font-weight: 900;
      margin-bottom: 12px;
    }
    .steps-sub {
      font-size: 15px;
      color: #6b7280;
      margin-bottom: 50px;
      line-height: 1.6;
    }
    .step-card {
      margin-bottom: 65px;
    }
    .step-badge {
      background: #2b59ea;
      color: white;
      padding: 10px 20px;
      border-radius: 30px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 16px;
      box-shadow: 0 8px 18px rgba(43,89,234,0.25);
    }
    .step-title {
      font-size: 26px;
      font-weight: 900;
      font-style: italic;
      margin-bottom: 10px;
    }
    .step-desc {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 18px;
      padding: 0 12px;
    }
    
    .step-img {
      width: 100%;
      border-radius: 26px;
      margin-top: 18px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.1);
    }
    
    .engine-section {
      padding: 30px 20px;
    }

    .engine-title {
      font-size: 24px;
      font-weight: 800;
      text-align: center;
      margin-bottom: 8px;
    }

    .engine-sub {
      text-align: center;
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 24px;
    }

/* CARD BASE */
   .engine-card {
      border-radius: 32px;
      padding: 26px;
      margin-bottom: 20px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.05);
    }

    /* LIGHT CARD */
   .engine-card.light {
      background: #f1f3f7;
    }

    /* BLUE CARD */
    .engine-card.blue {
      background: linear-gradient(135deg, #4f6cff, #2b59ea);
      color: white;
      position: relative;
      overflow: hidden;
    }

    /* ICON */
    .engine-icon {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;

      box-shadow: 
      0 6px 12px rgba(0,0,0,0.08),
      inset 0 1px 0 rgba(255,255,255,0.6);
    }

    .engine-icon.blue-bg {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(6px);
    }

    .engine-card h4 {
      font-size: 19px;
      font-weight: 800;
      font-style: italic;
      margin-bottom: 8px;
      color: #0f172a;
    }

    .engine-card p {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.6;
    }

    .engine-card.blue p {
      color: rgba(255,255,255,0.9);
    }
    
    .engine-card.blue::after {
      content: "";
      position: absolute;
      bottom: -40px;
      right: -40px;
      width: 120px;
      height: 120px;
      background: rgba(255,255,255,0.08);
      border-radius: 24px;
    }

    .verified {
      background: #eef2ff;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 40px;
      font-size: 11px;
      font-weight: 600;
      margin: 8px 0;
    }
    .step-img {
      width: 100%;
      border-radius: 24px;
      margin-top: 12px;
      background: #f8f9fe;
    }
   
    .footer {
      padding: 40px 20px 30px;
      text-align: center;
      background: #f8f9fc;
    }

/* LOGO */
    .footer-brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .footer-brand img {
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }

    .footer-brand span {
     font-size: 22px;
     font-weight: 800;
    }

   .footer-brand .blue {
     color: #2b59ea;
    }

/* COPYRIGHT */
   .footer-copy {
      font-size: 12px;
      color: #9ca3af;
      letter-spacing: 1px;
      margin-bottom: 22px;
    }

/* LINKS */
    .footer-links {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 700;
      color: #9ca3af;
      letter-spacing: 2px;
    }
    
    .bottom-tabs {
      position: sticky;
      bottom: 0;
      background: white;
      display: flex;
      justify-content: space-around;
      padding: 10px 20px 14px;
      border-top: 1px solid #eceef2;
      font-weight: 600;
      font-size: 12px;
      color: #8e8fa3;
    }
    .active-tab {
      color: #2b59ea;
    }
    .tab-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      cursor: default;
    }
    button {
      cursor: pointer;
    }
    .sticky-download {
      position: fixed;
      bottom: 20px;
      left: 0;
      width: 100%;
      padding: 12px 16px 18px;
      background: transparent;
      z-index: 999;
    }

/* BUTTON */
    .download-btn, .sticky-download button {
     display: inline-block;
     text-decoration: none;
     text-align: center;
     cursor: pointer;
    }
   .sticky-download a {
      display: block;
      width: 100%;
      padding: 16px;
      border-radius: 28px;
      background: linear-gradient(135deg, #4f6cff, #2b59ea);
      color: white;
      font-size: 16px;
      font-weight: 800;
      text-decoration: none;
      text-align: center;
      box-shadow: 0 10px 25px rgba(43,89,234,0.35);
    }

/* SAFE SPACE (content cut ना हो) */
   .phone-container {
      padding-bottom: 90px;
    }
  </style>
</head>
<body>
<div class="phone-container">
  <!-- header -->
  <div class="header">
    <div class="logo">
      <img src="/images/logo.jpeg" alt="logo">
      <span class="plus">Plus</span><span class="one">One</span>
    </div>
  </div>

  <!-- HERO SECTION - exactly like second image (1000123580.jpg) -->
  <div class="hero">
    <div class="premium-badge"> <i data-lucide="star" style="width:14px;height:14px;"></i>PREMIUM LIFESTYLE HUB</div>
    <h1>
     Elevate Your
     <span>Essence.</span>
    </h1>
    <div class="hero-desc">The ultimate destination for luxury products. Curated collections, seamless authentication, and a community of elite tastemakers.</div>
    <div class="ref-box">
      <span class="ref-label">REFERRAL CODE</span>
      <span class="ref-code" id="referralCode">${token}</span>
    </div>
    <a href="${apkUrl}" class="download-btn" id="downloadMainLink">📲 Instantly Download</a>
    <div class="brands">
      <span>DIOR</span> <span>ROLEX</span> <span>CHANEL</span> <span>PRADA</span>
    </div>
    <img class="phone-mock" src="/images/phone-mock.jpeg" alt="app">
  </div>

  <div class="feature-card">

  <div class="feature-logo-wrap">
    <img src="/images/logo.jpeg" />
  </div>

  <h3 class="feature-title">
    Your Actions, Your Rewards   Welcome to PlusOne.
  </h3>

  <p class="feature-desc">
    Be part of a fast-growing community where your every action unlocks rewards, savings, and access to premium brands.
  </p>

  <div class="feature-stats">
    
    <div class="stat">
      <h4>10k+</h4>
      <span>USERS</span>
    </div>

    <div class="divider"></div>

    <div class="stat">
      <h4>5K</h4>
      <span>BRANDS</span>
    </div>

    <div class="divider"></div>

    <div class="stat">
      <h4>4.9</h4>
      <span>RATING</span>
    </div>

  </div>
  </div>

  <!-- how to get started -->
  <div class="steps">
    <h3>How to Get Started</h3>
    <div class="steps-sub">Follow these simple steps to join the PlusOne elite community.</div>

    <!-- step 1 -->
    <div class="step-card">
      <div class="step-badge">STEP 1</div>
      <div class="step-title">Copy Referral code and Download APK</div>
      <div class="step-desc">On our official website, click the Download APK button to start downloading the PlusOne app.</div>
      <img class="step-img" src="/images/step1.jpeg" alt="step1">
    </div>

    <!-- step 2 -->
    <div class="step-card">
      <div class="step-badge">STEP 2</div>
      <div class="step-title">Install the app</div>
      <div class="step-desc">Once the download is complete, open the downloaded APK file and tap Install. If prompted, allow installation from unknown sources to proceed with the experience.</div>
      <div class="verified" id="verifiedBadge">
        <i data-lucide="shield-check" style="width: 14px; height: 14px;"></i>
        Verified Secure Installation
      </div>
      <img class="step-img" src="/images/step2.jpeg" alt="step2">
    </div>

    <!-- step 3 -->
    <div class="step-card">
      <div class="step-badge">STEP 3</div>
      <div class="step-title">Paste referral code and create account</div>
      <div class="step-desc">Open the app, go to the sign up page. Paste your referral code in the Referral ID field and complete your sign up to create your account and unlock member benefits.</div>
      <img class="step-img" src="/images/step3.jpeg" alt="step3">
    </div>
  </div>

  <!-- WHERE TO PASTE REFERRAL CODE? SECTION (from first image 1000123578) -->
  <div style="margin: 20px 20px 10px 20px; background: white; border-radius: 28px; padding: 20px; border: 1px solid #efeff5;">
    <h3 style="font-size: 20px; font-weight: 800; margin-bottom: 8px;">Where to Paste Your Referral Code?</h3>
    <p style="font-size: 13px; color: #5f6075; margin-bottom: 16px;">Follow these simple steps to apply your referral code and unlock exclusive benefits.</p>
    <ul style="list-style: none;">
      <li style="display: flex; gap: 12px; margin-bottom: 20px;">
        <span style="background: #eef2ff; width: 26px; height: 26px; border-radius: 30px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #2b59ea;">1</span>
        <div><strong>Sign Up / Create Account</strong><br>Fill in your basic details to get started.</div>
      </li>
      <li style="display: flex; gap: 12px; margin-bottom: 20px;">
        <span style="background: #eef2ff; width: 26px; height: 26px; border-radius: 30px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #2b59ea;">2</span>
        <div><strong>Find "Referral ID (Optional)"</strong><br>Scroll down to the referral code field.</div>
      </li>
      <li style="display: flex; gap: 12px; margin-bottom: 20px;">
        <span style="background: #eef2ff; width: 26px; height: 26px; border-radius: 30px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #2b59ea;">3</span>
        <div><strong>Paste Your Code</strong><br>Paste your referral code in the box as shown.</div>
      </li>
      <li style="display: flex; gap: 12px;">
        <span style="background: #eef2ff; width: 26px; height: 26px; border-radius: 30px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #2b59ea;">4</span>
        <div><strong>Create Account</strong><br>Complete your sign up and enjoy exclusive rewards.</div>
      </li>
    </ul>
  </div>
  
  <div class="engine-section">

  <h3 class="engine-title">Engineered for Elegance</h3>
  <p class="engine-sub">
    Our core principles drive every interaction within the PlusOne ecosystem.
  </p>

  <!-- CARD 1 -->
  <div class="engine-card light">
    <div class="engine-icon">
      <i data-lucide="shield-check"></i>
    </div>
    <h4>Guaranteed Authenticity</h4>
    <p>
      Every item undergoes a 12-point forensic verification by our in-house experts before shipment.
    </p>
  </div>

  <!-- CARD 2 (BLUE) -->
  <div class="engine-card blue">
    <div class="engine-icon blue-bg">
      <i data-lucide="zap"></i>
    </div>
    <h4>Real-Time Marketplace</h4>
    <p>
      Bid, buy, and trade in a high-frequency environment designed for high-end lifestyle enthusiasts.
    </p>
  </div>

  <!-- CARD 3 -->
  <div class="engine-card light">
    <div class="engine-icon">
      <i data-lucide="users"></i>
    </div>
    <h4>Exclusive Circle</h4>
    <p>
      Unlock access to invite-only product launches and digital-only NFT drops for the community.
    </p>
  </div>

</div>

  <!-- footer -->
 <div class="footer">

  <div class="footer-brand">
    <img src="/images/logo.jpeg" />
    <span>Plus<span class="blue">One</span></span>
  </div>

  <div class="footer-copy">
    © 2026 PLUSONE GLOBAL INC.
  </div>

  <div class="footer-links">
    <span>PRIVACY</span>
    <span>TERMS</span>
    <span>SAFETY</span>
    <span>SUPPORT</span>
  </div>

</div>

<div class="sticky-download">
  <a href="${apkUrl}" class="sticky-download-btn" id="bottomDownloadLink">📲 Download PlusOne App</a>
</div>

<script>
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    } else {
      // Agar lucide abhi load nahi hua, thoda wait karo
      setTimeout(function() {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }, 500);
    }
  });

  // copy referral code wala code yahan rahega
  const refCodeSpan = document.getElementById('referralCode');
  if(refCodeSpan) {
    refCodeSpan.addEventListener('click', () => {
      navigator.clipboard.writeText(refCodeSpan.innerText);
      const originalText = refCodeSpan.innerText;
      refCodeSpan.innerText = '✓ Copied!';
      setTimeout(() => {
        refCodeSpan.innerText = originalText;
      }, 1500);
    });
  }
</script>
</body>
</html>
  `;

  res.send(html);
});

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default router;