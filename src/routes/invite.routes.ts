import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  // Disable caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const token = (req.query.token as string) || '';
  const apkUrl = process.env.APK_DOWNLOAD_URL || 'https://poster-fl1x.onrender.com/poster.apk'; // fallback

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes, viewport-fit=cover">
  <title>Poster — Connect, Create, Share</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    /* ... (all styles remain same as your provided design) ... */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', sans-serif;
      background: #f0f2f5;
      display: flex;
      justify-content: center;
    }
    .phone-container {
      max-width: 500px;
      width: 100%;
      background: white;
      box-shadow: 0 0 30px rgba(0,0,0,0.08);
      margin: 0 auto;
      position: relative;
      padding-bottom: 90px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: white;
      border-bottom: 1px solid #eef2f5;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 24px;
    }
    .logo span:first-child {
      background: linear-gradient(135deg, #ff4757, #ff6b81);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .logo span:last-child {
      color: #1e2a3e;
    }
    .logo img {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      object-fit: cover;
    }
    .hero {
      padding: 24px 20px 0;
      text-align: center;
    }
    .badge {
      background: #eef2ff;
      color: #3b82f6;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 40px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 16px;
    }
    .hero h1 {
      font-size: 38px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -1px;
      color: #1e293b;
    }
    .hero h1 span {
      background: linear-gradient(135deg, #ff4757, #ff6b81);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .hero-desc {
      color: #5a6874;
      font-size: 15px;
      margin: 16px 0 24px;
      line-height: 1.5;
    }
    .ref-box {
      background: #f8fafc;
      border-radius: 60px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      border: 1px solid #e2e8f0;
      cursor: pointer;
      transition: 0.2s;
    }
    .ref-box:hover {
      background: #f1f5f9;
    }
    .ref-label {
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .ref-code {
      font-weight: 800;
      font-size: 15px;
      color: #3b82f6;
      letter-spacing: 0.5px;
    }
    .download-btn {
      background: linear-gradient(135deg, #ff4757, #ff6b81);
      width: 100%;
      border: none;
      padding: 16px;
      border-radius: 60px;
      color: white;
      font-weight: 800;
      font-size: 16px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 8px 20px rgba(255,71,87,0.25);
      cursor: pointer;
      transition: 0.2s;
    }
    .download-btn:hover {
      transform: scale(0.98);
      background: linear-gradient(135deg, #e04352, #ff5a6e);
    }
    .stats {
      display: flex;
      justify-content: space-between;
      background: white;
      padding: 16px 20px;
      border-radius: 48px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      margin: 20px 0;
    }
    .stat-item {
      text-align: center;
      flex: 1;
    }
    .stat-number {
      font-weight: 800;
      font-size: 20px;
      color: #1e293b;
    }
    .stat-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }
    .feature-grid {
      padding: 20px;
      background: #ffffff;
    }
    .feature-title {
      font-size: 24px;
      font-weight: 800;
      text-align: center;
      margin-bottom: 8px;
    }
    .feature-sub {
      text-align: center;
      font-size: 14px;
      color: #5a6874;
      margin-bottom: 24px;
    }
    .feature-card {
      background: #f8fafc;
      border-radius: 28px;
      padding: 20px;
      margin-bottom: 16px;
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .feature-icon {
      width: 50px;
      height: 50px;
      background: white;
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      color: #ff4757;
    }
    .feature-text h4 {
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 4px;
    }
    .feature-text p {
      font-size: 13px;
      color: #5a6874;
    }
    .steps {
      padding: 10px 20px 30px;
      background: #ffffff;
    }
    .steps h3 {
      font-size: 26px;
      font-weight: 800;
      text-align: center;
      margin-bottom: 8px;
    }
    .step-card {
      display: flex;
      gap: 16px;
      margin-bottom: 32px;
      align-items: flex-start;
    }
    .step-number {
      width: 36px;
      height: 36px;
      background: #ff4757;
      color: white;
      font-weight: 800;
      font-size: 18px;
      border-radius: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .step-content h4 {
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 4px;
    }
    .step-content p {
      font-size: 13px;
      color: #5a6874;
    }
    .footer {
      background: #ffffff;
      border-top: 1px solid #edf2f7;
      padding: 24px 20px;
      text-align: center;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 12px;
      font-size: 12px;
      font-weight: 600;
      color: #94a3b8;
    }
    .sticky-download {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      padding: 12px 16px 20px;
      background: transparent;
      z-index: 999;
    }
    .sticky-download button {
      width: 100%;
      padding: 14px;
      border-radius: 60px;
      border: none;
      background: linear-gradient(135deg, #ff4757, #ff6b81);
      color: white;
      font-size: 16px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
    }
    .phone-mock {
      width: 100%;
      border-radius: 32px;
      margin-top: 12px;
      box-shadow: 0 12px 24px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
<div class="phone-container">
  <div class="header">
    <div class="logo">
      <img src="/images/logo.png" alt="Poster logo">   <!-- ✅ public folder से -->
      <span>Poster</span>
    </div>
  </div>

  <div class="hero">
    <div class="badge"><i data-lucide="sparkles" style="width:14px;"></i> JOIN THE MOVEMENT</div>
    <h1>Share What <span>Matters.</span></h1>
    <div class="hero-desc">Poster is the new social canvas – connect with creators, share your story, and grow your community. No algorithms, no noise.</div>
    
    <div class="ref-box" id="refBox">
      <span class="ref-label">YOUR INVITE CODE</span>
      <span class="ref-code" id="referralCode">${token}</span>
    </div>
    
    <button class="download-btn" id="downloadMainBtn"><i data-lucide="download"></i> Get Poster App</button>
    
    <div class="stats">
      <div class="stat-item"><div class="stat-number">500K+</div><div class="stat-label">Active Users</div></div>
      <div class="stat-item"><div class="stat-number">10M+</div><div class="stat-label">Posts Shared</div></div>
      <div class="stat-item"><div class="stat-number">4.9★</div><div class="stat-label">Rating</div></div>
    </div>
  </div>

  <div class="feature-grid">
    <div class="feature-title">Built for Creators</div>
    <div class="feature-sub">Everything you need to express yourself freely</div>
    
    <div class="feature-card">
      <div class="feature-icon"><i data-lucide="image"></i></div>
      <div class="feature-text"><h4>Rich Media Posts</h4><p>Photos, videos, carousels, and text – tell your story your way.</p></div>
    </div>
    <div class="feature-card">
      <div class="feature-icon"><i data-lucide="users"></i></div>
      <div class="feature-text"><h4>Real Connections</h4><p>Follow, comment, and collaborate without spammy algorithms.</p></div>
    </div>
    <div class="feature-card">
      <div class="feature-icon"><i data-lucide="zap"></i></div>
      <div class="feature-text"><h4>Lightning Fast</h4><p>Optimized for speed – scroll endlessly without lag.</p></div>
    </div>
  </div>

  <div class="steps">
    <h3>Join in 3 simple steps</h3>
    <div class="step-card">
      <div class="step-number">1</div>
      <div class="step-content"><h4>Download the App</h4><p>Get Poster APK from our official website – secure and trusted.</p></div>
    </div>
    <div class="step-card">
      <div class="step-number">2</div>
      <div class="step-content"><h4>Install & Open</h4><p>Allow installation from unknown sources (safe & verified).</p></div>
    </div>
    <div class="step-card">
      <div class="step-number">3</div>
      <div class="step-content"><h4>Paste Invite Code & Sign Up</h4><p>Use your unique invite code to unlock exclusive badges and features.</p></div>
    </div>
  </div>

  <div class="footer">
    <div class="logo" style="justify-content: center;">Poster</div>
    <div class="footer-links"><span>About</span><span>Privacy</span><span>Terms</span><span>Support</span></div>
    <div style="font-size: 11px; color: #94a3b8; margin-top: 16px;">© 2026 Poster Social Inc.</div>
  </div>
</div>

<div class="sticky-download">
  <button id="bottomDownloadBtn"><i data-lucide="download"></i> Get Poster for Android</button>
</div>

<script>
  lucide.createIcons();

  const refCodeSpan = document.getElementById('referralCode');
  if(refCodeSpan) {
    refCodeSpan.addEventListener('click', () => {
      navigator.clipboard.writeText(refCodeSpan.innerText);
      const original = refCodeSpan.innerText;
      refCodeSpan.innerText = '✓ Copied!';
      setTimeout(() => refCodeSpan.innerText = original, 1500);
    });
  }

  const APK_URL = "${apkUrl}";
  function handleDownload() { window.location.href = APK_URL; }
  
  document.getElementById("downloadMainBtn")?.addEventListener("click", handleDownload);
  document.getElementById("bottomDownloadBtn")?.addEventListener("click", handleDownload);
</script>
</body>
</html>`;

  res.send(html);
});

export default router;