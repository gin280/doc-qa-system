import { Variants } from 'framer-motion';

/**
 * 动画时长配置（毫秒）
 */
export const ANIMATION_DURATION = {
  fast: 150,    // 微交互（按钮 hover）
  base: 200,    // 页面切换、模态框
  slow: 300,    // 复杂动画
  hero: 500,    // Hero区域动画
} as const;

/**
 * 动画缓动函数配置
 */
export const ANIMATION_EASING = {
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  easeInOut: [0.4, 0, 0.2, 1],
} as const;

/**
 * 检测用户是否启用了减少动画偏好
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * 检测是否为移动设备
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
};

/**
 * Hero区域渐入动画（从下往上 + 淡入）
 */
export const fadeInUp: Variants = {
  initial: { 
    opacity: 0, 
    y: 20 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: ANIMATION_DURATION.hero / 1000,
      ease: ANIMATION_EASING.easeOut,
    }
  },
};

/**
 * 简单淡入动画
 */
export const fadeIn: Variants = {
  initial: { 
    opacity: 0 
  },
  animate: { 
    opacity: 1,
    transition: {
      duration: ANIMATION_DURATION.base / 1000,
      ease: ANIMATION_EASING.easeOut,
    }
  },
};

/**
 * 交错动画配置（用于列表项）
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1, // 每个子元素延迟100ms
    }
  },
};

/**
 * 列表项淡入动画
 */
export const staggerItem: Variants = {
  initial: { 
    opacity: 0, 
    y: 10 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: ANIMATION_DURATION.base / 1000,
    }
  },
};

/**
 * 缩放淡入动画（用于模态框）
 */
export const scaleIn: Variants = {
  initial: { 
    opacity: 0, 
    scale: 0.95 
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: {
      duration: ANIMATION_DURATION.base / 1000,
      ease: ANIMATION_EASING.easeOut,
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: ANIMATION_DURATION.fast / 1000,
    }
  },
};

/**
 * 获取动画配置（考虑用户偏好）
 */
export const getAnimationConfig = (variant: Variants): Variants => {
  // 如果用户启用了减少动画偏好，返回无动画配置
  if (prefersReducedMotion()) {
    return {
      initial: variant.animate,
      animate: variant.animate,
    };
  }
  
  // 移动端简化动画
  if (isMobileDevice()) {
    return fadeIn; // 使用简单淡入
  }
  
  return variant;
};

