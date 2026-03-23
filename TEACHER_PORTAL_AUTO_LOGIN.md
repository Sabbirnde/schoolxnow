# Teacher Portal Auto-Login Guide

## Overview
Teachers can now be automatically logged into the teacher portal using secure magic links. This eliminates the need for teachers to remember passwords while maintaining security.

## How It Works

### 1. **Magic Link Auto-Login Flow**
```
Teacher clicks link → Automatic authentication → Dashboard opens
No password needed!
```

### 2. **Session Persistence**
- Sessions are automatically stored in browser `localStorage`
- When teachers return, they're automatically logged back in
- Sessions auto-refresh before expiration
- Token-based security with PKCE flow

## For Administrators

### Generating Teacher Portal Links

#### Method 1: Using Teacher Portal Utilities (Programmatic)

```typescript
import { generateTeacherMagicLink, sendTeacherPortalLink } from '@/lib/teacher-portal-utils';

// Generate a magic link
const linkResult = await generateTeacherMagicLink({
  teacherEmail: 'teacher@school.edu',
  redirectPath: '/teacher-portal',
  expiresIn: 86400, // 24 hours
});

if (!linkResult.error) {
  console.log('Magic link ready:', linkResult.plainLink);
  // Share this link with the teacher
}
```

#### Method 2: Direct Portal Access
Teachers can simply visit: `https://yourschool.com/teacher-portal`

If they have an active session, they're automatically logged in.
If not, they're redirected to the login page.

### URL Format
```
https://yourschool.com/teacher-portal?teacher_id=TEACHER_ID&redirect=/dashboard
```

Parameters:
- `teacher_id`: Optional - pre-selects the teacher
- `redirect`: Optional - directs after auth

## For Teachers

### First Time Login
1. Receive a secure link from your school administrator
2. Click the link
3. Click "Sign in with magic link" button
4. Check your email for the login code
5. Copy the code and paste it into the form
6. You're now logged in!

### Subsequent Logins
1. Visit `https://yourschool.com/teacher-portal`
2. You're automatically logged in if you have an active session
3. If session expired, click "Continue"
4. You'll receive a new magic link via email

### How to Stay Logged In
- Don't clear your browser cache
- Don't clear cookies for this website
- Allow browser to save your session

### Logout
- Click your profile icon → Logout
- This clears your local session
- You'll be redirected to login page

## Security Features

✅ **PKCE Flow** - Secure authentication protocol
✅ **Token Refresh** - Automatic token renewal
✅ **Email Verification** - Every login confirmed via email
✅ **Session Isolation** - Separate storage key per app
✅ **Time-Limited** - Magic links expire after 24 hours
✅ **No Password Storage** - Uses industry-standard Supabase Auth

## Technical Details

### Session Storage Location
- **Key**: `schoolxnow-auth-token`
- **Storage**: Browser localStorage
- **Managed by**: Supabase Auth
- **Cleared when**: User logs out or clears browser data

### Auto-Login Implementation

**On App Start:**
1. AuthProvider checks for stored session
2. If valid, automatically restores
3. Fetches teacher profile from database
4. Redirects to dashboard

**On Link Click:**
1. TeacherPortalEntry page loads
2. Extracts authentication token from URL
3. Verifies teacher role
4. Restores session
5. Redirects to dashboard

### File Structure
```
src/
├── pages/
│   └── TeacherPortalEntry.tsx        # Teacher portal entry page
├── lib/
│   └── teacher-portal-utils.ts       # Magic link generation & utilities
└── hooks/
    └── useAuth.tsx                   # Auth context with OTP support
```

## Environment Configuration

Teacher portal auto-login uses the same Supabase configuration as the main app:

```typescript
// From supabase/client.ts
auth: {
  storage: localStorage,
  storageKey: 'schoolxnow-auth-token',
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,      // ← Important for magic links
  flowType: 'pkce',
}
```

## Troubleshooting

### Issue: Not Logged In After Clicking Link
**Solution:**
- Clear browser cache and try again
- Check if email verification is required
- Ensure cookies are enabled
- Try a different browser

### Issue: Session Expires Too Quickly
**Solution:**
- Tokens auto-refresh - this is normal
- If expired, simply click the magic link sent in email
- Admin can adjust token expiry if needed

### Issue: Can't Receive Magic Link Email
**Solution:**
- Check spam folder
- Verify email address is correct
- Contact school administrator
- Check if email service is configured

## API Reference

### Core Functions

#### `generateTeacherMagicLink(options)`
Generates a secure magic link for teacher auto-login.

**Parameters:**
```typescript
{
  teacherEmail: string;          // Teacher's email
  redirectPath?: string;         // Where to redirect after (default: /teacher-portal)
  expiresIn?: number;            // Expiration in seconds (default: 86400 = 24h)
}
```

**Returns:**
```typescript
{
  magicLink: string;            // Ready-to-use link
  plainLink: string;            // Plain version without session
  expiresAt: Date;              // Expiration timestamp
  error?: string;               // Error message if failed
}
```

#### `isTeacherSession()`
Checks if current user is a teacher.

**Returns:** `boolean`

#### `recoverTeacherSession()`
Attempts to restore teacher session from storage.

**Returns:**
```typescript
{
  success: boolean;
  teacherId?: string;           // If successful
}
```

#### `storeTeacherSessionToken(token)`
Manually store teacher session token.

#### `clearTeacherSessionToken()`
Clear stored teacher session.

## Best Practices

1. **Always verify email** before granting access
2. **Send links via secure email** only
3. **Test on multiple devices** before deployment
4. **Monitor auth logs** for suspicious activity
5. **Educate teachers** about not sharing links
6. **Set reasonable token expiry** (24-48 hours)

## Support

For issues or questions:
- Check browser console for error messages
- Verify Supabase configuration
- Review auth logs in Supabase dashboard
- Contact system administrator

---

**Version:** 1.0
**Last Updated:** 2026-03-23
**Status:** Production Ready ✅
