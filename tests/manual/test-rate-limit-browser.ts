/**
 * Manual Browser Test for Upload Rate Limiting
 * Story 4.1 - Upload Rate Limit Testing
 * 
 * This script tests the upload rate limit functionality by:
 * 1. Authenticating with a test user
 * 2. Making 10 consecutive upload requests (should succeed)
 * 3. Making the 11th request (should return 429)
 * 4. Validating the 429 response structure
 */

import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3000';
const TEST_USER = {
  email: 'ratelimit.test@example.com',
  password: 'Test@123456'
};

// Helper function to get session cookie
async function getSessionCookie(): Promise<string> {
  console.log('🔐 Authenticating test user...');
  
  // Get CSRF token
  const csrfResponse = await fetch(`${API_BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfResponse.json();
  
  // Login
  const loginResponse = await fetch(`${API_BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      email: TEST_USER.email,
      password: TEST_USER.password,
      csrfToken,
      callbackUrl: `${API_BASE}/chat`,
      json: 'true'
    })
  });

  const cookies = loginResponse.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('Failed to get session cookie');
  }

  console.log('✅ Authentication successful');
  return cookies;
}

// Helper function to create a test file
function createTestFile(): Buffer {
  const content = `# Test Document ${Date.now()}

This is a test document for rate limit testing.
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
`;
  return Buffer.from(content);
}

// Helper function to upload a file
async function uploadFile(sessionCookie: string, fileNumber: number): Promise<Response> {
  const formData = new FormData();
  const fileContent = createTestFile();
  const blob = new Blob([fileContent], { type: 'text/markdown' });
  formData.append('file', blob, `test-${fileNumber}.md`);

  return fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: {
      'Cookie': sessionCookie
    },
    body: formData
  });
}

// Main test function
async function runRateLimitTest() {
  console.log('\n🧪 Starting Upload Rate Limit Test (Story 4.1)\n');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Authenticate
    const sessionCookie = await getSessionCookie();
    
    // Step 2: Test first 10 uploads (should all succeed)
    console.log('\n📤 Testing first 10 uploads (should succeed)...');
    const results: Array<{attempt: number, status: number, success: boolean}> = [];
    
    for (let i = 1; i <= 10; i++) {
      console.log(`  Upload ${i}/10...`);
      const response = await uploadFile(sessionCookie, i);
      const success = response.status !== 429;
      results.push({
        attempt: i,
        status: response.status,
        success
      });
      
      if (success) {
        console.log(`    ✅ Success (${response.status})`);
      } else {
        console.log(`    ❌ Failed (${response.status}) - Should have succeeded!`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Step 3: Test 11th upload (should return 429)
    console.log('\n🚫 Testing 11th upload (should be rate limited)...');
    const response11 = await uploadFile(sessionCookie, 11);
    const status11 = response11.status;
    
    console.log(`  Status: ${status11}`);
    
    if (status11 === 429) {
      console.log('  ✅ Correctly returned 429 (Rate Limited)');
      
      // Step 4: Validate 429 response
      console.log('\n🔍 Validating 429 response structure...');
      
      // Check headers
      const retryAfter = response11.headers.get('Retry-After');
      const rateLimitLimit = response11.headers.get('X-RateLimit-Limit');
      const rateLimitRemaining = response11.headers.get('X-RateLimit-Remaining');
      const rateLimitReset = response11.headers.get('X-RateLimit-Reset');
      
      console.log(`  Retry-After: ${retryAfter || 'Missing ❌'}`);
      console.log(`  X-RateLimit-Limit: ${rateLimitLimit || 'Missing ❌'}`);
      console.log(`  X-RateLimit-Remaining: ${rateLimitRemaining || 'Missing ❌'}`);
      console.log(`  X-RateLimit-Reset: ${rateLimitReset || 'Missing ❌'}`);
      
      // Check response body
      const responseBody = await response11.json();
      console.log('\n  Response Body:');
      console.log(`    error: ${responseBody.error || 'Missing ❌'}`);
      console.log(`    details.limit: ${responseBody.details?.limit || 'Missing ❌'}`);
      console.log(`    details.remaining: ${responseBody.details?.remaining ?? 'Missing ❌'}`);
      console.log(`    details.retryAfter: ${responseBody.details?.retryAfter || 'Missing ❌'}`);
      console.log(`    details.resetAt: ${responseBody.details?.resetAt || 'Missing ❌'}`);
      
      // Validate Chinese error message
      const hasChinese = /[\u4e00-\u9fa5]/.test(responseBody.error || '');
      console.log(`\n  Chinese error message: ${hasChinese ? '✅ Yes' : '❌ No'}`);
      
      // Step 5: Summary
      console.log('\n' + '=' .repeat(60));
      console.log('📊 Test Summary:');
      console.log('=' .repeat(60));
      
      const successfulUploads = results.filter(r => r.success).length;
      const failedUploads = results.filter(r => !r.success).length;
      
      console.log(`\n✅ AC1: Rate Limit (10/min): ${successfulUploads === 10 ? 'PASS' : 'FAIL'}`);
      console.log(`   - Successful uploads: ${successfulUploads}/10`);
      console.log(`   - Failed uploads: ${failedUploads}/10`);
      
      console.log(`\n✅ AC2: 11th Request Returns 429: ${status11 === 429 ? 'PASS' : 'FAIL'}`);
      console.log(`   - Status code: ${status11}`);
      
      const hasRetryAfter = retryAfter !== null;
      const hasRateLimitHeaders = rateLimitLimit !== null && rateLimitRemaining !== null;
      const hasDetails = responseBody.details && responseBody.details.limit && responseBody.details.retryAfter;
      
      console.log(`\n✅ AC2: Response Headers: ${hasRetryAfter && hasRateLimitHeaders ? 'PASS' : 'FAIL'}`);
      console.log(`   - Retry-After header: ${hasRetryAfter ? 'Present' : 'Missing'}`);
      console.log(`   - Rate limit headers: ${hasRateLimitHeaders ? 'Present' : 'Missing'}`);
      
      console.log(`\n✅ AC2: Response Body: ${hasDetails ? 'PASS' : 'FAIL'}`);
      console.log(`   - Error message (Chinese): ${hasChinese ? 'Present' : 'Missing'}`);
      console.log(`   - Limit details: ${hasDetails ? 'Present' : 'Missing'}`);
      
      console.log('\n' + '=' .repeat(60));
      console.log('🎉 Rate Limit Test Completed!');
      console.log('=' .repeat(60));
      
    } else {
      console.log(`  ❌ Failed! Expected 429, got ${status11}`);
      console.log('\n❌ TEST FAILED: 11th upload should have been rate limited');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    throw error;
  }
}

// Run the test
runRateLimitTest().catch(console.error);

