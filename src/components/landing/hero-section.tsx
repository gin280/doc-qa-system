'use client';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeInUp, getAnimationConfig, staggerContainer, staggerItem } from '@/lib/animations';

export function HeroSection() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24">
      <div className="w-full max-w-5xl text-center space-y-8">
        {/* Logo */}
        <motion.div
          {...getAnimationConfig(fadeInUp)}
          className="flex justify-center mb-8"
        >
          <Logo size="lg" href="/" />
        </motion.div>

        {/* Hero Section */}
        <motion.div
          {...getAnimationConfig(fadeInUp)}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold">
            智能文档问答系统
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            基于 AI 的智能文档分析与问答平台
          </p>
          <p className="text-base text-muted-foreground/80 max-w-xl mx-auto">
            上传您的文档，让 AI 帮您快速找到答案，提升工作效率
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          {...getAnimationConfig(staggerContainer)}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8"
          role="group"
          aria-label="主要操作"
        >
          <motion.div {...getAnimationConfig(staggerItem)}>
            <Link href="/register" aria-label="免费注册账号">
              <Button size="lg" className="w-full sm:w-auto min-w-[200px]">
                免费开始使用
              </Button>
            </Link>
          </motion.div>
          <motion.div {...getAnimationConfig(staggerItem)}>
            <Link href="/login" aria-label="登录已有账号">
              <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[200px]">
                登录
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}

