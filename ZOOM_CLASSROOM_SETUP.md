# Duvela Zoom Classroom setup

Duvela uses two separate real-time products:

- `classroom.html` + Zoom Video SDK for interactive group lessons.
- `live.html` + Agora for mass broadcasts, reactions, gifts and monetization.

## One-time setup

1. Create a **Zoom Video SDK** app in Zoom Marketplace. OAuth/Meeting SDK credentials are not compatible.
2. In Supabase SQL Editor run `scripts/zoom-classroom.sql`.
3. Add Edge Function secrets:

   ```powershell
   supabase secrets set ZOOM_VIDEO_SDK_KEY="..." ZOOM_VIDEO_SDK_SECRET="..."
   ```

4. Deploy the token function:

   ```powershell
   supabase functions deploy zoom-video-token
   ```

5. Build and deploy the site:

   ```powershell
   npm run build
   ```

Never put `ZOOM_VIDEO_SDK_SECRET` in browser environment files. The browser receives only a short-lived, membership-checked session token.
