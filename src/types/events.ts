/**
 * React 事件类型定义
 * 
 * 提供常用的 React 事件类型别名，消除事件处理器中的 `any` 类型
 */

import { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent } from 'react'

/**
 * 表单提交事件类型
 * 
 * @example
 * ```typescript
 * const handleSubmit = (e: FormSubmitEvent) => {
 *   e.preventDefault()
 *   // 处理表单提交
 * }
 * 
 * <form onSubmit={handleSubmit}>...</form>
 * ```
 */
export type FormSubmitEvent = FormEvent<HTMLFormElement>

/**
 * Input 输入框变更事件类型
 * 
 * @example
 * ```typescript
 * const handleChange = (e: InputChangeEvent) => {
 *   setValue(e.target.value)
 *   // TypeScript 知道 e.target 是 HTMLInputElement
 * }
 * 
 * <input onChange={handleChange} />
 * ```
 */
export type InputChangeEvent = ChangeEvent<HTMLInputElement>

/**
 * Textarea 文本域变更事件类型
 * 
 * @example
 * ```typescript
 * const handleChange = (e: TextareaChangeEvent) => {
 *   setText(e.target.value)
 *   // TypeScript 知道 e.target 是 HTMLTextAreaElement
 * }
 * 
 * <textarea onChange={handleChange} />
 * ```
 */
export type TextareaChangeEvent = ChangeEvent<HTMLTextAreaElement>

/**
 * Button 按钮点击事件类型
 * 
 * @example
 * ```typescript
 * const handleClick = (e: ButtonClickEvent) => {
 *   e.preventDefault()
 *   // 处理按钮点击
 * }
 * 
 * <button onClick={handleClick}>Click</button>
 * ```
 */
export type ButtonClickEvent = ReactMouseEvent<HTMLButtonElement>

/**
 * 通用的变更事件处理器类型
 * 
 * @template T - 目标元素类型 (HTMLInputElement 或 HTMLTextAreaElement)
 * 
 * @example
 * ```typescript
 * const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
 *   setValue(e.target.value)
 * }
 * 
 * const handleTextareaChange: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
 *   setText(e.target.value)
 * }
 * ```
 */
export type ChangeEventHandler<T extends HTMLInputElement | HTMLTextAreaElement> = 
  (event: ChangeEvent<T>) => void

