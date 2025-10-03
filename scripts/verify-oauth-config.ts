#!/usr/bin/env node

/**
 * OAuth 配置验证脚本
 * QA-SEC-001: 确保生产环境 OAuth 配置正确
 * 
 * 在部署前运行此脚本验证所有必需的环境变量
 * 使用: npm run verify:oauth 或 node scripts/verify-oauth-config.ts
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateOAuthConfig(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  console.log('🔍 验证 OAuth 配置...\n');

  // 1. 验证 NEXTAUTH_URL
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (!nextAuthUrl) {
    result.valid = false;
    result.errors.push('❌ NEXTAUTH_URL 未设置');
  } else {
    console.log(`✓ NEXTAUTH_URL: ${nextAuthUrl}`);
    
    // 生产环境必须使用 HTTPS
    if (process.env.NODE_ENV === 'production' && !nextAuthUrl.startsWith('https://')) {
      result.valid = false;
      result.errors.push('❌ 生产环境 NEXTAUTH_URL 必须使用 HTTPS');
    }
    
    // 警告：不应使用 localhost
    if (process.env.NODE_ENV === 'production' && nextAuthUrl.includes('localhost')) {
      result.warnings.push('⚠️  生产环境不应使用 localhost');
    }
  }

  // 2. 验证 NEXTAUTH_SECRET
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (!nextAuthSecret) {
    result.valid = false;
    result.errors.push('❌ NEXTAUTH_SECRET 未设置');
  } else {
    if (nextAuthSecret.length < 32) {
      result.valid = false;
      result.errors.push('❌ NEXTAUTH_SECRET 长度不足（至少32字符）');
    } else {
      console.log('✓ NEXTAUTH_SECRET: 已设置且长度足够');
    }
  }

  // 3. 验证 Google OAuth 配置
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!googleClientId || !googleClientSecret) {
    result.warnings.push('⚠️  Google OAuth 未配置（GOOGLE_CLIENT_ID 或 GOOGLE_CLIENT_SECRET 缺失）');
  } else {
    console.log('✓ Google OAuth: 已配置');
    
    // 验证 Google Client ID 格式
    if (!googleClientId.endsWith('.apps.googleusercontent.com')) {
      result.warnings.push('⚠️  GOOGLE_CLIENT_ID 格式可能不正确（应以 .apps.googleusercontent.com 结尾）');
    }
  }

  // 4. 验证 GitHub OAuth 配置
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
  
  if (!githubClientId || !githubClientSecret) {
    result.warnings.push('⚠️  GitHub OAuth 未配置（GITHUB_CLIENT_ID 或 GITHUB_CLIENT_SECRET 缺失）');
  } else {
    console.log('✓ GitHub OAuth: 已配置');
  }

  // 5. 验证数据库配置
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    result.valid = false;
    result.errors.push('❌ DATABASE_URL 未设置');
  } else {
    console.log('✓ DATABASE_URL: 已设置');
    
    // 警告：生产环境不应使用 localhost
    if (process.env.NODE_ENV === 'production' && databaseUrl.includes('localhost')) {
      result.warnings.push('⚠️  生产环境不应使用 localhost 数据库');
    }
  }

  return result;
}

function printSecurityChecklist() {
  console.log('\n📋 生产部署前安全检查清单（QA-SEC-001）:\n');
  console.log('  [ ] 在 Google Cloud Console 配置 OAuth 回调 URL 白名单');
  console.log('      仅允许: https://your-domain.com/api/auth/callback/google\n');
  console.log('  [ ] 在 GitHub OAuth App 配置回调 URL 白名单');
  console.log('      仅允许: https://your-domain.com/api/auth/callback/github\n');
  console.log('  [ ] 在 Vercel/部署平台设置所有必需的环境变量');
  console.log('  [ ] 确认 NEXTAUTH_SECRET 是随机生成的强密钥（至少32字符）');
  console.log('  [ ] 确认生产环境使用 HTTPS');
  console.log('  [ ] 手动测试完整 OAuth 流程（使用真实 Google/GitHub 账号）');
  console.log('  [ ] 验证 OAuth 失败时的错误处理');
  console.log('  [ ] 验证用户头像正确显示\n');
}

// 主执行逻辑
const result = validateOAuthConfig();

console.log('\n' + '='.repeat(60));

if (result.errors.length > 0) {
  console.log('\n❌ 配置验证失败:\n');
  result.errors.forEach(error => console.log(error));
  console.log('');
}

if (result.warnings.length > 0) {
  console.log('\n⚠️  警告:\n');
  result.warnings.forEach(warning => console.log(warning));
  console.log('');
}

if (result.valid && result.warnings.length === 0) {
  console.log('\n✅ 所有配置验证通过！\n');
} else if (result.valid) {
  console.log('\n✅ 必需配置已设置（存在一些警告）\n');
}

printSecurityChecklist();

// 返回退出码
process.exit(result.valid ? 0 : 1);

