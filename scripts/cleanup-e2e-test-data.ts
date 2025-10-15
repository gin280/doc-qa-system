/**
 * 清理 E2E 测试数据脚本
 * 手动清理所有 E2E 测试产生的数据
 */

import { cleanupAllE2ETestData } from '../tests/integration/e2e/helpers/e2e-setup';

async function main() {
  console.log('🚀 Starting E2E test data cleanup...\n');

  try {
    await cleanupAllE2ETestData();
    console.log('\n✨ Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

main();

