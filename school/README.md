Local: .env (root folder) banayein (.env.example dekhein), npm install, phir do terminal: npm run dev:api aur npm run dev.

Campuses: 7C Campus, Karachi Cambridge School 4/B, SAJ Nighat Mannan Campus 7/D, Campus 5-B/3, Campus 7/A.
Director -> "Campus Logins" page se har campus ka email/password banata hai.

== Free deploy: Cloudflare Pages + Render + MongoDB Atlas ==
1) Render (server): New > Web Service > is repo ko chunein
   Root Directory: (khali chhorein)   Build Command: npm install   Start Command: npm start
   Region: Singapore   Plan: Free
   Environment Variables: MONGO_URI, JWT_SECRET (.env.example dekhein)
   Deploy ke baad link milega, jaise https://xyz.onrender.com
2) Cloudflare Pages (website): Create > Pages > Connect to Git > is repo ko chunein
   Build command: npm run build   Output directory: dist
   Environment variable: VITE_API = https://xyz.onrender.com   (Render wala link, aakhir mein / nahi)
3) UptimeRobot: HTTP monitor, URL https://xyz.onrender.com/api/health, har 5 minute
4) Atlas: Network Access mein 0.0.0.0/0 allow karein
5) Weekly backup: mongodump --uri="MONGO_URI" --out=backup
Vercel wali files (vercel.json, api/index.js) is setup mein use nahi hotin, rehne dein ya hata dein.
