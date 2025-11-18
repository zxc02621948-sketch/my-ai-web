import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import FacebookProvider from "next-auth/providers/facebook"
import { dbConnect } from "@/lib/db"
import User from "@/models/User"
import bcrypt from "bcryptjs"

// ✅ 檢查必要的環境變數
const hasOAuthConfig = !!(
  process.env.NEXTAUTH_SECRET &&
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.FACEBOOK_CLIENT_ID &&
  process.env.FACEBOOK_CLIENT_SECRET
);

const providers = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      try {
        await dbConnect()
        const user = await User.findOne({ email: credentials.email })
        
        if (!user) {
          return null
        }

        // ✅ 檢查用戶是否有密碼（OAuth 用戶可能沒有密碼）
        if (!user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        
        if (!isPasswordValid) {
          return null
        }

        return {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          image: user.image
        }
      } catch (error) {
        console.error("Auth error:", error)
        return null
      }
    }
  })
];

// ✅ 只有在環境變數完整時才添加 OAuth providers
if (hasOAuthConfig) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET
    })
  );
}

export const authOptions = {
  providers,
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        await dbConnect()
        
        // ✅ 只有 OAuth 登入才需要處理帳號關聯
        if (account?.provider === "google" || account?.provider === "facebook") {
          const email = user.email
          const providerId = account.providerAccountId
          const provider = account.provider
          
          if (!email) {
            console.error("❌ OAuth 登入缺少 email")
            return false
          }
          
          // 查找是否已有相同 email 的用戶
          const existingUser = await User.findOne({ email })
          
          if (existingUser) {
            // ✅ 帳號已存在：檢查是否已關聯此 provider
            const hasProvider = existingUser.providers?.some(
              (p) => p.provider === provider && p.providerId === providerId
            )
            
            if (!hasProvider) {
              // ✅ 新增登入方式到 providers 陣列
              if (!existingUser.providers) {
                existingUser.providers = []
              }
              existingUser.providers.push({
                provider,
                providerId,
                linkedAt: new Date()
              })
              
              // ✅ 如果用戶還沒有設定主要 provider，設定為當前的 OAuth provider
              if (existingUser.provider === "local" || !existingUser.provider) {
                existingUser.provider = provider
                existingUser.providerId = providerId
              }
              
              await existingUser.save()
            }
            
            // ✅ OAuth 用戶自動標記為已驗證
            if (!existingUser.isVerified) {
              existingUser.isVerified = true
              await existingUser.save()
            }
          } else {
            // ✅ 新用戶：自動建立帳號
            // 生成唯一的 username（使用 email 前綴 + 隨機數字）
            let username = email.split("@")[0]
            let usernameAvailable = false
            let counter = 1
            
            while (!usernameAvailable) {
              const exists = await User.findOne({ username })
              if (!exists) {
                usernameAvailable = true
              } else {
                username = `${email.split("@")[0]}${counter}`
                counter++
              }
            }
            
            // 建立新用戶
            const newUser = await User.create({
              email,
              username,
              provider: provider,
              providerId: providerId,
              providers: [{
                provider: provider,
                providerId: providerId,
                linkedAt: new Date()
              }],
              image: user.image || profile?.picture || "",
              isVerified: true, // ✅ OAuth 用戶自動驗證
              password: undefined // ✅ OAuth 用戶不需要密碼
            })
            
            console.log("✅ OAuth 新用戶建立成功:", newUser._id)
          }
        }
        
        return true
      } catch (error) {
        console.error("❌ signIn callback 錯誤:", error)
        return false
      }
    },
    async jwt({ token, user, account }) {
      // ✅ 首次登入時，從資料庫取得完整的用戶資訊
      if (user) {
        try {
          await dbConnect()
          const dbUser = await User.findOne({ email: user.email })
          
          if (dbUser) {
            token.id = dbUser._id.toString()
            token.email = dbUser.email
            token.username = dbUser.username
            token.image = dbUser.image
            token.isAdmin = dbUser.isAdmin || false
            token.provider = dbUser.provider || "local"
          }
        } catch (error) {
          console.error("❌ JWT callback 錯誤:", error)
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (token && token.id) {
        session.user.id = token.id
        session.user.email = token.email
        session.user.username = token.username
        session.user.image = token.image
        session.user.isAdmin = token.isAdmin || false
        session.user.provider = token.provider || "local"
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  },
  // ✅ 如果沒有 NEXTAUTH_SECRET，使用一個固定的 fallback（僅用於開發環境）
  // 生產環境如果沒有配置，NextAuth 會報錯，但不會影響其他功能
  secret: process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === "development" ? "fallback-secret-for-development-only-change-in-production" : "fallback-secret-not-configured"),
  // ✅ 設置 NEXTAUTH_URL（如果未設置，NextAuth 會嘗試自動檢測）
  ...(process.env.NEXTAUTH_URL && { url: process.env.NEXTAUTH_URL }),
  debug: process.env.NODE_ENV === "development",
  // ✅ 添加錯誤處理
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      // 可選：記錄登入事件
    },
    async signOut({ session, token }) {
      // 可選：記錄登出事件
    },
    async error({ error }) {
      console.error("❌ NextAuth 錯誤:", error)
    }
  }
}
